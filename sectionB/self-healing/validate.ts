import type { Locator, Page } from 'playwright';
import { buildLocator, specToCode, strategyRank } from './spec.js';
import type { Candidate, Check, LocatorIntent, Verdict } from './types.js';

type Role = Parameters<Page['getByRole']>[0];

/** Does the element a locator resolves to satisfy the intent's declared fingerprint? */
export async function fingerprintChecks(page: Page, locator: Locator, intent: LocatorIntent): Promise<Check[]> {
  const checks: Check[] = [];
  const { role, name, text, within } = intent.expect;
  if (role) {
    const same = await locator.and(page.getByRole(role as Role, name !== undefined ? { name } : {})).count();
    const want = name !== undefined ? `role ${role} named ${String(name)}` : `role ${role}`;
    checks.push({ name: 'fingerprint: role and name', ok: same === 1, detail: same === 1 ? `element has ${want}` : `element does not have ${want}` });
  } else if (name !== undefined) {
    const label = (await locator.getAttribute('aria-label')) ?? (await locator.innerText());
    const ok = typeof name === 'string' ? label.trim() === name : name.test(label);
    checks.push({ name: 'fingerprint: name', ok, detail: `name/text "${label.slice(0, 60)}" vs ${String(name)}` });
  }
  if (within) {
    const container = page.getByRole(within.role as Role, { name: within.name, exact: true });
    const inside = await container.locator('*').and(locator).count();
    checks.push({ name: 'fingerprint: container', ok: inside === 1, detail: `${inside === 1 ? 'inside' : 'not inside'} ${within.role} "${within.name}"` });
  }
  if (text) {
    const shown = (await locator.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    checks.push({ name: 'fingerprint: text', ok: text.test(shown), detail: `text "${shown.slice(0, 60)}" vs ${text}` });
  }
  return checks;
}

/**
 * Every gate a suggestion must pass before it is used or proposed. The
 * vocabulary gate already ran when the provider output was parsed. Here: not
 * the failed locator again, exactly one match, visible, and the same fingerprint
 * the original locator promised. In heal mode the scenario's own assertions then
 * replay the step on the healed locator, which is the final gate.
 */
export async function validateCandidate(page: Page, intent: LocatorIntent, candidate: Candidate, brokenCode: string): Promise<Verdict> {
  const code = specToCode(candidate.spec);
  const checks: Check[] = [{ name: 'vocabulary', ok: true, detail: `${candidate.spec.by} strategy, no CSS/XPath/position` }];
  const verdict = (): Verdict => ({ candidate, code, ok: checks.every((c) => c.ok), checks });

  const differs = code !== brokenCode;
  checks.push({ name: 'differs from failed locator', ok: differs, detail: differs ? 'new locator' : 'same as the failed locator' });
  if (!differs) return verdict();

  const locator = buildLocator(page, candidate.spec);
  await locator.first().waitFor({ state: 'attached', timeout: 2_000 }).catch(() => undefined);
  const count = await locator.count();
  checks.push({ name: 'unique match', ok: count === 1, detail: `${count} element(s) matched` });
  if (count !== 1) return verdict();

  const visible = await locator.isVisible();
  checks.push({ name: 'visible', ok: visible, detail: visible ? 'visible' : 'hidden' });
  if (!visible) return verdict();

  checks.push(...(await fingerprintChecks(page, locator, intent)));
  return verdict();
}

/** Accepted verdicts first, then by the provider's confidence, then by how user-facing the strategy is. */
export function rankVerdicts(verdicts: Verdict[]): Verdict[] {
  return [...verdicts].sort(
    (a, b) => Number(b.ok) - Number(a.ok) || b.candidate.confidence - a.candidate.confidence || strategyRank(a.candidate.spec) - strategyRank(b.candidate.spec),
  );
}
