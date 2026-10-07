import type { Candidate, HealProvider, Incident, InventoryItem, LocatorSpec, ProviderResult } from '../types.js';

/**
 * Offline, deterministic healer: no network, no model. It scores every element
 * in the inventory against the strings in the failed locator (catching renames
 * and typos), the intent description and the declared fingerprint, then turns
 * the best elements into locators in preference order. It exists so the POC
 * runs anywhere, and as the fallback when an LLM provider is unavailable.
 */
export const heuristic: HealProvider = {
  name: 'heuristic',
  async suggest(incident: Incident): Promise<ProviderResult> {
    const started = Date.now();
    const hints = hintsFrom(incident.brokenLocator);
    const intentWords = words(incident.description);
    const expectName = toRegExp(incident.expect.name);
    const expectText = toRegExp(incident.expect.text);
    const expectWithin = incident.expect.within;

    const scored = incident.inventory
      .filter((item) => item.visible)
      .map((item) => {
        const fields = [item.testid, item.name, item.label, item.placeholder, item.text.slice(0, 60)].filter((f): f is string => !!f);
        const hintScore = Math.max(0, ...hints.flatMap((h) => fields.map((f) => similarity(h, f))));
        const own = new Set([...fields.flatMap(words), ...(item.container ? words(item.container.name) : [])]);
        const intentScore = intentWords.length ? intentWords.filter((w) => own.has(w)).length / intentWords.length : 0;
        let score = 0.5 * hintScore + 0.4 * intentScore;
        if (incident.expect.role) score += item.role === incident.expect.role ? 0.3 : -0.4;
        if (expectName) score += expectName.test(item.name) ? 0.3 : -0.1;
        if (expectText) score += expectText.test(item.text) ? 0.2 : -0.1;
        if (expectWithin) score += item.container && `${item.container.role} "${item.container.name}"` === expectWithin ? 0.3 : -0.3;
        if (incident.kind === 'ambiguous' && item.matchedBroken) score += 0.2;
        return { item, score };
      })
      .filter((s) => s.score > 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const candidates: Candidate[] = [];
    const seen = new Set<string>();
    for (const { item, score } of scored) {
      for (const spec of specsFor(item)) {
        const key = JSON.stringify(spec);
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({ spec, confidence: Math.min(1, Number(score.toFixed(2))), rationale: describe(item, score), provider: 'heuristic' });
      }
    }
    return { provider: 'heuristic', candidates: candidates.slice(0, 8), malformed: [], durationMs: Date.now() - started };
  },
};

/** Locators for one element, most user-facing first; a scoped variant follows each unscoped one. */
function specsFor(item: InventoryItem): LocatorSpec[] {
  const within: LocatorSpec | undefined = item.container ? { by: 'role', role: item.container.role, name: item.container.name, exact: true } : undefined;
  const base: LocatorSpec[] = [];
  if (item.role && item.name) base.push({ by: 'role', role: item.role, name: item.name, exact: true });
  if (item.label) base.push({ by: 'label', value: item.label, exact: true });
  if (item.testid) base.push({ by: 'testid', value: item.testid });
  if (item.placeholder) base.push({ by: 'placeholder', value: item.placeholder, exact: true });
  if (!base.length && item.text && item.text.length <= 60) base.push({ by: 'text', value: item.text, exact: true });
  return base.flatMap((spec) => (within ? [spec, { ...spec, within }] : [spec]));
}

function describe(item: InventoryItem, score: number): string {
  const what = [item.role && `${item.role}`, item.name && `"${item.name}"`, item.testid && `testid "${item.testid}"`].filter(Boolean).join(' ');
  return `Best textual and structural match (score ${score.toFixed(2)}): ${what || item.tag}${item.container ? ` in ${item.container.role} "${item.container.name}"` : ''}.`;
}

/** String arguments of the failed locator, plus ids and class names inside any CSS it used. */
function hintsFrom(locator: string): string[] {
  const literals = [...locator.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1] ?? m[2]);
  const cssTokens = literals.flatMap((l) => [...l.matchAll(/[#.]([\w-]+)|\[[\w-]+=["']?([^"'\]]+)/g)].map((m) => m[1] ?? m[2]));
  return [...new Set([...literals, ...cssTokens])].filter((h) => h && h.length > 1);
}

function words(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}
const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'shows', 'showing', 'button', 'field', 'element', 'page']);

/** Dice coefficient over character bigrams: tolerant of renames such as "kpi-total-loan" vs "kpi-total-loans". */
function similarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i += 1) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) ?? 0) + 1);
    return out;
  };
  const gx = grams(x);
  const gy = grams(y);
  let overlap = 0;
  for (const [g, n] of gx) overlap += Math.min(n, gy.get(g) ?? 0);
  return (2 * overlap) / (x.length - 1 + (y.length - 1));
}

function toRegExp(value: string | undefined): RegExp | null {
  if (!value) return null;
  const m = /^\/(.*)\/([a-z]*)$/.exec(value);
  return m ? new RegExp(m[1], m[2]) : new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
}
