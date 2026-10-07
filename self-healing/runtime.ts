import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from 'playwright';
import { env } from '../tests/config/env.js';
import { collectInventory } from './inventory.js';
import { pickProvider, suggestWithFallback } from './providers/index.js';
import { renderSuggestions } from './report.js';
import { buildLocator } from './spec.js';
import { callerSource, makePatch } from './source.js';
import type { FailureKind, Incident, LocatorIntent, SourceRef, Suggestion } from './types.js';
import { fingerprintChecks, rankVerdicts, validateCandidate } from './validate.js';

interface ScenarioContext {
  scenario: string;
  attach: (data: string, mediaType: string) => void;
}

let current: ScenarioContext | null = null;
const suggestions: Suggestion[] = [];

/** Called from a Before hook so incidents can be attached to the right scenario. */
export function beginScenario(context: ScenarioContext) {
  current = context;
}

/** Called from an After hook: in heal mode the scenario outcome is the replay gate. */
export function endScenario(status: 'passed' | 'failed') {
  for (const s of suggestions) if (s.scenario === current?.scenario && s.replay === 'pending') s.replay = status;
  if (suggestions.length) renderSuggestions(outDir(), suggestions);
  current = null;
}

export const outDir = () => path.join(env.artifacts.reportDir, 'healing');

export class LocatorHealingError extends Error {
  constructor(message: string, readonly incidentFile: string) {
    super(message);
    this.name = 'LocatorHealingError';
  }
}

/**
 * A locator with a declared intent. `resolve()` returns the locator unchanged when
 * it still finds the right element. Otherwise it records an incident and,
 * depending on SELF_HEAL:
 *   off      fail with a precise diagnosis (detection only),
 *   suggest  ask the healer, validate, record a reviewed-ready patch, still fail,
 *   heal     as suggest, then continue this run on the validated locator.
 * Source files are never modified.
 */
export class HealableLocator {
  constructor(
    private readonly page: Page,
    readonly intent: LocatorIntent,
    private readonly build: (page: Page) => Locator,
    private readonly source: SourceRef | null,
  ) {}

  /** The declared locator, as written in the page object. */
  declared(): Locator {
    return this.build(this.page);
  }

  async resolve(): Promise<Locator> {
    const locator = this.declared();
    const diagnosis = await this.diagnose(locator);
    if (!diagnosis) return locator;
    return this.heal(locator, diagnosis);
  }

  async diagnose(locator: Locator): Promise<{ kind: FailureKind; count: number; detail: string } | null> {
    await locator.first().waitFor({ state: 'attached', timeout: 5_000 }).catch(() => undefined);
    const count = await locator.count();
    if (count === 0) return { kind: 'no-match', count, detail: 'No element matched within 5 s.' };
    if (count > 1) return { kind: 'ambiguous', count, detail: `${count} elements matched; an action on it would violate strict mode.` };
    if (!(await locator.isVisible())) return { kind: 'not-visible', count, detail: 'The only match is hidden.' };
    const failed = (await fingerprintChecks(this.page, locator, this.intent)).filter((c) => !c.ok);
    if (failed.length) return { kind: 'wrong-element', count, detail: `Resolved, but ${failed.map((c) => c.detail).join('; ')}.` };
    return null;
  }

  private async heal(locator: Locator, diagnosis: { kind: FailureKind; count: number; detail: string }): Promise<Locator> {
    const { mode, provider: providerName } = env.selfHealing;
    const brokenCode = `page.${locator.toString()}`;
    const { incident, file } = await this.captureIncident(locator, brokenCode, diagnosis);
    const headline = `Locator "${this.intent.key}" failed: ${incident.brokenLocator} → ${diagnosis.detail}`;
    current?.attach(`${headline}\nIncident: ${path.relative(process.cwd(), file)}`, 'text/plain');

    if (mode === 'off') {
      throw new LocatorHealingError(`${headline}\nSelf-healing is off. Run "npm run heal" for a validated suggestion. Incident: ${file}`, file);
    }

    const result = await suggestWithFallback(pickProvider(providerName), incident);
    const verdicts = rankVerdicts(await Promise.all(result.candidates.map((c) => validateCandidate(this.page, this.intent, c, brokenCode))));
    const accepted = verdicts.find((v) => v.ok) ?? null;
    const suggestion: Suggestion = {
      key: this.intent.key,
      scenario: current?.scenario ?? '',
      brokenLocator: brokenCode,
      kind: diagnosis.kind,
      detail: diagnosis.detail,
      mode,
      provider: result.provider,
      providerNote: result.note,
      durationMs: result.durationMs,
      costUsd: result.costUsd,
      accepted,
      alternatives: verdicts.filter((v) => v !== accepted),
      malformed: result.malformed,
      source: this.source,
      patch: accepted ? makePatch(this.source, accepted.code.replace(/^page\./, `${this.source?.param ?? 'page'}.`)) : null,
      incidentFile: path.relative(process.cwd(), file),
      replay: accepted && mode === 'heal' ? 'pending' : 'not-run',
    };
    suggestions.push(suggestion);
    renderSuggestions(outDir(), suggestions);

    const summary = accepted
      ? `Healer (${result.provider}) proposes ${accepted.code}\n${accepted.checks.map((c) => `  ${c.ok ? '✔' : '✖'} ${c.name}: ${c.detail}`).join('\n')}\nRationale: ${accepted.candidate.rationale}`
      : `Healer (${result.provider}) found no candidate that passed validation (${verdicts.length} failed, ${result.malformed.length} malformed).`;
    current?.attach(summary + (result.note ? `\nNote: ${result.note}` : ''), 'text/plain');

    if (mode === 'heal' && accepted) {
      current?.attach(`HEALED IN THIS RUN ONLY: "${this.intent.key}" now uses ${accepted.code}. The page object is unchanged; review the patch in ${path.relative(process.cwd(), outDir())}/SUGGESTIONS.md.`, 'text/plain');
      return buildLocator(this.page, accepted.candidate.spec);
    }
    throw new LocatorHealingError(`${headline}\n${summary}`, file);
  }

  private async captureIncident(locator: Locator, brokenCode: string, diagnosis: { kind: FailureKind; count: number; detail: string }) {
    const dir = path.join(outDir(), 'incidents');
    mkdirSync(dir, { recursive: true });
    const screenshot = path.join(dir, `${this.intent.key}.png`);
    await this.page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
    const incident = await this.snapshot(locator, brokenCode, diagnosis, path.relative(process.cwd(), screenshot));
    const file = path.join(dir, `${this.intent.key}.json`);
    writeFileSync(file, `${JSON.stringify(incident, null, 2)}\n`);
    return { incident, file };
  }

  /** Everything a healer is shown about a failure. Page structure only: no cookies, storage or field values. */
  async snapshot(locator: Locator, brokenCode: string, diagnosis: { kind: FailureKind; count: number; detail: string }, screenshot: string | null = null): Promise<Incident> {
    return {
      key: this.intent.key,
      description: this.intent.description,
      expect: describeFingerprint(this.intent.expect),
      brokenLocator: brokenCode,
      kind: diagnosis.kind,
      matchCount: diagnosis.count,
      detail: diagnosis.detail,
      url: this.page.url(),
      scenario: current?.scenario ?? '',
      source: this.source,
      ariaSnapshot: await this.page.locator('body').ariaSnapshot({ timeout: 5_000 }).catch((e: Error) => `# snapshot failed: ${e.message}`),
      inventory: await collectInventory(this.page, locator),
      screenshot,
      at: new Date().toISOString(),
    };
  }
}

/** The fingerprint as the healer reads it: patterns as /source/flags, a container as `role "name"`. */
export function describeFingerprint(expect: LocatorIntent['expect']): Incident['expect'] {
  return Object.fromEntries(
    Object.entries(expect).map(([k, v]) => [k, typeof v === 'object' && !(v instanceof RegExp) ? `${v.role} "${v.name}"` : String(v)]),
  );
}

/** Declare a locator together with what it is for. The declaring line is recorded for patch suggestions. */
export function healable(page: Page, intent: LocatorIntent, build: (page: Page) => Locator): HealableLocator {
  return new HealableLocator(page, intent, build, callerSource());
}
