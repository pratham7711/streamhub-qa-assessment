/**
 * Self-healing locators, a proof of concept (docs/SELF_HEALING.md).
 *
 * A page object declares each locator with its intent: what it is for, and a fingerprint of the
 * element it must find. resolve() checks the locator against that declaration, so a locator that
 * quietly finds the wrong element is caught as well as one that finds nothing. When it fails:
 *   SELF_HEAL off   the step fails with the diagnosis (detection only; the default);
 *   SELF_HEAL=heal  Claude proposes replacements, each one is validated on the live page, and the
 *                   first that passes is used for this run only. The page object is never edited:
 *                   suggestions go to <reports>/<suite>/healing/SUGGESTIONS.md for a person to apply.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from 'playwright';
import { env } from '../framework/config/env.js';
import { askClaude, buildLocator, specToCode, type LocatorSpec } from './claude.js';

type Role = Parameters<Page['getByRole']>[0];

export interface LocatorIntent {
  /** Stable id, e.g. "dashboard.totalLoansValue". */
  key: string;
  /** What the element is for, in plain words: the main thing Claude is told. */
  description: string;
  /** What the element must be. `within` names its container: "digits only" alone fits every number on the page. */
  expect: { role?: string; name?: string | RegExp; text?: RegExp; within?: { role: string; name: string } };
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

interface Suggestion {
  key: string;
  scenario: string;
  failed: string;
  diagnosis: string;
  accepted?: { code: string; spec: LocatorSpec; rationale: string; checks: Check[] };
  rejected: { code: string; reason: string }[];
  seconds?: number;
  costUsd?: number;
  error?: string;
  /** Did the scenario pass on the healed locator? Its own assertions are the last validation gate. */
  replay: 'passed' | 'failed' | 'not run';
}

const suggestions: Suggestion[] = [];
const outDir = () => path.join(env.reportDir, 'healing');

/** Does the element a locator resolves to fit the declared fingerprint? */
async function fingerprint(page: Page, locator: Locator, intent: LocatorIntent): Promise<Check[]> {
  const { role, name, text, within } = intent.expect;
  const checks: Check[] = [];
  if (role) {
    const same = (await locator.and(page.getByRole(role as Role, { name })).count()) === 1;
    checks.push({ name: 'role and name', ok: same, detail: `${same ? 'is' : 'is not'} a ${role}${name === undefined ? '' : ` named ${String(name)}`}` });
  }
  if (within) {
    const inside = (await page.getByRole(within.role as Role, { name: within.name, exact: true }).locator('*').and(locator).count()) === 1;
    checks.push({ name: 'container', ok: inside, detail: `${inside ? 'inside' : 'not inside'} ${within.role} "${within.name}"` });
  }
  if (text) {
    const shown = (await locator.innerText().catch(() => '')).trim();
    checks.push({ name: 'text', ok: text.test(shown), detail: `text "${shown.slice(0, 40)}" ${text.test(shown) ? 'matches' : 'does not match'} ${text}` });
  }
  return checks;
}

/** Why a locator does not find exactly one visible element that fits its intent; null when it does. */
async function diagnose(page: Page, locator: Locator, intent: LocatorIntent): Promise<string | null> {
  await locator.first().waitFor({ state: 'attached', timeout: 5_000 }).catch(() => undefined);
  const count = await locator.count();
  if (count === 0) return 'no element matched within 5 s';
  if (count > 1) return `${count} elements matched, so any action on it breaks strict mode`;
  if (!(await locator.isVisible())) return 'the only match is hidden';
  const failed = (await fingerprint(page, locator, intent)).filter((c) => !c.ok);
  return failed.length ? `it found one element, but the wrong one: ${failed.map((c) => c.detail).join('; ')}` : null;
}

/** What Claude is shown: the accessibility tree and the test ids. No cookies, storage or network data. */
async function buildPrompt(page: Page, intent: LocatorIntent, failed: string, diagnosis: string): Promise<string> {
  const aria = (await page.locator('body').ariaSnapshot()).slice(0, 12_000);
  // Test ids are not in the accessibility tree, so each is listed with the labelled container it sits in.
  const testIds = await page.locator('[data-testid]').evaluateAll((elements) =>
    elements.map((el) => {
      const box = el.closest('[aria-label], [aria-labelledby]');
      const label = box?.getAttribute('aria-label') ?? document.getElementById(box?.getAttribute('aria-labelledby') ?? '')?.textContent ?? '';
      return `data-testid="${el.getAttribute('data-testid')}" text="${el.textContent?.trim()}" inside "${label}"`;
    }),
  );
  const expected = Object.entries(intent.expect).map(([k, v]) => `${k}: ${typeof v === 'object' && !(v instanceof RegExp) ? `${v.role} "${v.name}"` : String(v)}`);
  return `<purpose key="${intent.key}">${intent.description}</purpose>
<expected_fingerprint>${expected.join('; ')}</expected_fingerprint>
<failed_locator>${failed}</failed_locator>
<failure>${diagnosis}</failure>
<page url="${page.url()}">
${aria}
</page>
<test_ids>
${testIds.join('\n')}
</test_ids>

Propose replacement locators for the failed one.`;
}

/** The gates a candidate must pass before it is used: a new locator, one match, visible, and the declared fingerprint. */
async function validate(page: Page, intent: LocatorIntent, spec: LocatorSpec, failed: string): Promise<Check[]> {
  if (specToCode(spec) === failed) return [{ name: 'new locator', ok: false, detail: 'same as the failed locator' }];
  const locator = buildLocator(page, spec);
  const count = await locator.count();
  const checks: Check[] = [{ name: 'unique', ok: count === 1, detail: `${count} element(s) matched` }];
  if (count !== 1) return checks;
  const visible = await locator.isVisible();
  checks.push({ name: 'visible', ok: visible, detail: visible ? 'visible' : 'hidden' });
  return visible ? [...checks, ...(await fingerprint(page, locator, intent))] : checks;
}

export class HealableLocator {
  constructor(
    private readonly page: Page,
    readonly intent: LocatorIntent,
    private readonly build: (page: Page) => Locator,
    private readonly scenario: { name: string; attach: (text: string) => void },
  ) {}

  /** The declared locator when it still finds the right element; otherwise a validated replacement, or an error. */
  async resolve(): Promise<Locator> {
    const locator = this.build(this.page);
    const diagnosis = await diagnose(this.page, locator, this.intent);
    if (!diagnosis) return locator;
    const failed = `page.${locator}`;
    const headline = `Locator "${this.intent.key}" failed: ${failed}: ${diagnosis}.`;
    this.scenario.attach(headline);
    if (!env.selfHeal) throw new Error(`${headline}\nSelf-healing is off. Run "npm run heal" to ask Claude for a validated replacement.`);

    const prompt = await buildPrompt(this.page, this.intent, failed, diagnosis);
    mkdirSync(path.join(outDir(), 'prompts'), { recursive: true });
    writeFileSync(path.join(outDir(), 'prompts', `${this.intent.key}.txt`), prompt);
    const s: Suggestion = { key: this.intent.key, scenario: this.scenario.name, failed, diagnosis, rejected: [], replay: 'not run' };
    suggestions.push(s);
    try {
      const answer = await askClaude(prompt);
      Object.assign(s, { seconds: answer.seconds, costUsd: answer.costUsd });
      s.rejected.push(...answer.malformed.map((m) => ({ code: JSON.stringify(m.raw), reason: `not allowed: ${m.reason}` })));
      for (const { spec, rationale } of answer.candidates) {
        const checks = await validate(this.page, this.intent, spec, failed);
        const failures = checks.filter((c) => !c.ok);
        if (failures.length) s.rejected.push({ code: specToCode(spec), reason: failures.map((c) => c.detail).join('; ') });
        else s.accepted ??= { code: specToCode(spec), spec, rationale, checks };
      }
    } catch (error) {
      s.error = (error as Error).message;
    }
    writeReport();

    if (!s.accepted) throw new Error(`${headline}\n${s.error ?? `Claude proposed no locator that passed validation (${s.rejected.length} rejected).`}`);
    this.scenario.attach(`HEALED FOR THIS RUN ONLY: "${this.intent.key}" now uses ${s.accepted.code}\n${s.accepted.rationale}\nThe page object is unchanged; see healing/SUGGESTIONS.md.`);
    return buildLocator(this.page, s.accepted.spec);
  }
}

/** Declare a locator together with what it is for. */
export function healable(page: Page, intent: LocatorIntent, build: (page: Page) => Locator, scenario: HealableLocator['scenario']) {
  return new HealableLocator(page, intent, build, scenario);
}

/** Called after each scenario: a healed scenario that then passed is the final check on the fix. */
export function recordReplay(scenario: string, passed: boolean): void {
  const healed = suggestions.filter((s) => s.scenario === scenario && s.accepted);
  for (const s of healed) s.replay = passed ? 'passed' : 'failed';
  if (healed.length) writeReport();
}

function writeReport(): void {
  const healed = suggestions.filter((s) => s.accepted);
  const cost = suggestions.reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
  const rows = suggestions.map((s) => `| \`${s.key}\` | ${s.diagnosis} | ${s.accepted ? `\`${s.accepted.code}\`` : '**none**'} | ${s.replay} |`);
  const details = suggestions.map(
    (s) => `## \`${s.key}\`

- **Scenario:** ${s.scenario}
- **Failed locator:** \`${s.failed}\`
- **Claude:** ${s.error ? `error: ${s.error}` : `${s.seconds?.toFixed(1)} s${s.costUsd === undefined ? '' : `, $${s.costUsd.toFixed(3)}`}`} · prompt in \`prompts/${s.key}.txt\`
- **Accepted:** ${s.accepted ? `\`${s.accepted.code}\` (${s.accepted.checks.map((c) => `✔ ${c.name}`).join(' · ')}). ${s.accepted.rationale}` : 'nothing; the test stays red for a person to look at'}
- **Rejected:** ${s.rejected.length ? s.rejected.map((r) => `\n  - \`${r.code}\`: ${r.reason}`).join('') : 'none'}`,
  );
  mkdirSync(outDir(), { recursive: true });
  writeFileSync(
    path.join(outDir(), 'SUGGESTIONS.md'),
    `# Self-healing suggestions

${healed.length} of ${suggestions.length} broken locators have a validated replacement; ${suggestions.filter((s) => s.replay === 'passed').length} of those scenarios then passed on it. Claude cost $${cost.toFixed(3)} in total.
Nothing here has been applied to the source.

| Locator | Why it failed | Suggested replacement | Scenario on the fix |
|---|---|---|---|
${rows.join('\n')}

${details.join('\n\n')}
`,
  );
}
