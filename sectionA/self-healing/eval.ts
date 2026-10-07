/**
 * npm run heal:eval [-- --providers heuristic,claude-cli --modes open,blind --trials 3]
 *
 * Measures the healers instead of demonstrating them. For each case it captures the incident
 * the runtime would capture, asks every provider for candidates several times, and scores each
 * answer against ground truth: the element that the healthy page objects in loanlens-ui/pages
 * (the ones the UI suite runs on) resolve to. The removed Export CSV button has no ground truth,
 * so the only right answer there is a refusal.
 *
 * Two sets of cases:
 *   exercise  the five broken locators of the self-healing exercise;
 *   decoy     harder cases that exist only here: the target has look-alikes on the page, or its
 *             new name shares no word with the old one, so a plausible wrong answer is on offer.
 *
 * Two prompt conditions:
 *   open   the healer sees the intent's fingerprint (role, name, container), as at runtime;
 *   blind  the fingerprint is withheld from the healer and used only by the validator, which
 *          shows whether the healer found the element or was handed its description.
 *
 * Writes self-healing/eval-results/EVAL.md and results.json. Exits 1 if any trial accepted
 * a wrong element (a false heal), because that is the failure that turns a test green for
 * the wrong reason.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Locator, type Page } from 'playwright';
import { env } from '../framework/config/env.js';
import { CalculatorPage } from '../loanlens-ui/pages/CalculatorPage.js';
import { DashboardPage } from '../loanlens-ui/pages/DashboardPage.js';
import { ReportsPage } from '../loanlens-ui/pages/ReportsPage.js';
import { LoanDetailPage } from '../loanlens-ui/pages/LoanDetailPage.js';
import { LegacyLocators } from './pages/LegacyLocators.js';
import { assertWebBuilt, ensureAppServer, stopAppServer } from '../framework/support/app-server.js';
import { claudeCliAvailable } from './providers/claude-cli.js';
import { pickProvider } from './providers/index.js';
import { healable as declareHealable, type HealableLocator } from './runtime.js';
import { buildLocator } from './spec.js';
import type { Incident, LocatorIntent, Verdict } from './types.js';
import { rankVerdicts, validateCandidate } from './validate.js';

interface EvalCase {
  key: string;
  set: 'exercise' | 'decoy';
  open: (page: Page) => Promise<void>;
  broken: (page: Page) => HealableLocator;
  /** The element a correct fix must find, per the healthy page objects; null when nothing should be found. */
  truth: ((page: Page) => Locator) | null;
}

/** Eight chart bars, a legend item and a key-figure group all carry the name "Principal". */
const LOAN_PRINCIPAL: LocatorIntent = {
  key: 'decoy.loanPrincipalValue',
  description: 'The principal amount in the key figures of a loan detail page',
  expect: { text: /^₹[\d,]+$/, within: { role: 'group', name: 'Principal' } },
};

/** "Clear all filters" became "Reset": no shared word, while "Apply filters" shares one. */
const RESET_FILTERS: LocatorIntent = {
  key: 'decoy.reportsResetButton',
  description: 'The button that clears the report filters back to their defaults',
  expect: { role: 'button', name: /^reset$/i },
};

const CASES: EvalCase[] = [
  { key: 'dashboard.totalLoansValue', set: 'exercise', open: (p) => new DashboardPage(p).open(), broken: (p) => new LegacyLocators(p).totalLoansValue, truth: (p) => new DashboardPage(p).keyFigures.value('Total loans') },
  { key: 'reports.applyFiltersButton', set: 'exercise', open: (p) => new ReportsPage(p).open(), broken: (p) => new LegacyLocators(p).applyFiltersButton, truth: (p) => new ReportsPage(p).applyButton },
  { key: 'calculator.loanAmountSlider', set: 'exercise', open: (p) => new CalculatorPage(p).open(), broken: (p) => new LegacyLocators(p).loanAmountSlider, truth: (p) => new CalculatorPage(p).slider('Loan amount') },
  { key: 'dashboard.recentDisbursementsTable', set: 'exercise', open: (p) => new DashboardPage(p).open(), broken: (p) => new LegacyLocators(p).recentDisbursementsTable, truth: (p) => new DashboardPage(p).recentTable },
  { key: 'reports.exportCsvButton', set: 'exercise', open: (p) => new ReportsPage(p).open(), broken: (p) => new LegacyLocators(p).exportCsvButton, truth: null },
  { key: LOAN_PRINCIPAL.key, set: 'decoy', open: (p) => new LoanDetailPage(p, 'LN-1001').open(), broken: (p) => declareHealable(p, LOAN_PRINCIPAL, (q) => q.getByTestId('loan-principal')), truth: (p) => new LoanDetailPage(p, 'LN-1001').keyFigures.value('Principal') },
  { key: RESET_FILTERS.key, set: 'decoy', open: (p) => new ReportsPage(p).open(), broken: (p) => declareHealable(p, RESET_FILTERS, (q) => q.getByRole('button', { name: 'Clear all filters', exact: true })), truth: (p) => new ReportsPage(p).resetButton },
];

type Mode = 'open' | 'blind';
type Outcome = 'correct' | 'FALSE HEAL' | 'missed' | 'refused' | 'error';

interface Trial {
  provider: string;
  mode: Mode;
  key: string;
  trial: number;
  outcome: Outcome;
  accepted: string | null;
  /** The provider's own first choice, before validation: is it the right element? */
  topRight: boolean;
  candidates: { code: string; passed: boolean; right: boolean }[];
  malformed: number;
  ms: number;
  costUsd?: number;
  error?: string;
}

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const trials = Number(option('trials', '3'));
const modes = option('modes', 'open,blind').split(',') as Mode[];
const requested = option('providers', claudeCliAvailable() ? 'heuristic,claude-cli' : 'heuristic').split(',');
if (!Number.isInteger(trials) || trials < 1 || modes.some((m) => m !== 'open' && m !== 'blind')) {
  console.error('Usage: npm run heal:eval -- [--providers heuristic,claude-cli,anthropic] [--modes open,blind] [--trials N]');
  process.exit(2);
}
const providers = requested.map((name) => pickProvider(name));

async function sameElement(candidate: Locator, truth: Locator): Promise<boolean> {
  if ((await candidate.count()) !== 1) return false;
  const target = await truth.elementHandle();
  return candidate.evaluate((element, other) => element === other, target);
}

assertWebBuilt();
await ensureAppServer();
const browser = await chromium.launch({ headless: env.browser.headless });
const context = await browser.newContext({ viewport: env.browser.viewport });
const results: Trial[] = [];
try {
  for (const c of CASES) {
    const page = await context.newPage();
    await c.open(page);
    const healable = c.broken(page);
    const broken = healable.declared();
    const diagnosis = await healable.diagnose(broken);
    if (!diagnosis) throw new Error(`${c.key}: the broken locator now finds the right element, so this case tests nothing`);
    const brokenCode = `page.${broken.toString()}`;
    const incident = await healable.snapshot(broken, brokenCode, diagnosis);
    const truth = c.truth?.(page) ?? null;
    if (truth && (await truth.count()) !== 1) throw new Error(`${c.key}: the ground-truth locator matched ${await truth.count()} elements`);

    for (const provider of providers) {
      for (const mode of modes) {
        const shown: Incident = mode === 'blind' ? { ...incident, expect: {} } : incident;
        for (let t = 1; t <= trials; t += 1) {
          const started = Date.now();
          try {
            const answer = await provider.suggest(shown);
            const scored = await Promise.all(
              answer.candidates.map(async (candidate) => ({
                verdict: await validateCandidate(page, healable.intent, candidate, brokenCode),
                right: truth ? await sameElement(buildLocator(page, candidate.spec), truth) : false,
              })),
            );
            const rightOf = new Map<Verdict, boolean>(scored.map((s) => [s.verdict, s.right]));
            const accepted = rankVerdicts(scored.map((s) => s.verdict)).find((v) => v.ok) ?? null;
            const outcome: Outcome = truth ? (accepted ? (rightOf.get(accepted) ? 'correct' : 'FALSE HEAL') : 'missed') : accepted ? 'FALSE HEAL' : 'refused';
            results.push({
              provider: provider.name, mode, key: c.key, trial: t, outcome,
              accepted: accepted?.code ?? null,
              topRight: scored[0]?.right ?? false,
              candidates: scored.map((s) => ({ code: s.verdict.code, passed: s.verdict.ok, right: s.right })),
              malformed: answer.malformed.length,
              ms: answer.durationMs,
              costUsd: answer.costUsd,
            });
          } catch (error) {
            results.push({ provider: provider.name, mode, key: c.key, trial: t, outcome: 'error', accepted: null, topRight: false, candidates: [], malformed: 0, ms: Date.now() - started, error: (error as Error).message.slice(0, 200) });
          }
          const last = results.at(-1)!;
          console.log(`${last.provider.padEnd(20)} ${mode.padEnd(5)} ${c.key.padEnd(34)} #${t} ${last.outcome.padEnd(10)} ${last.accepted ?? last.error ?? ''}`);
        }
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  await stopAppServer();
}

// ---------------------------------------------------------------- scoring

/** 95% Wilson score interval: honest error bars for a rate measured on a handful of trials. */
function wilson(k: number, n: number): string {
  if (!n) return '—';
  const z = 1.96;
  const p = k / n;
  const centre = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
  return `${Math.round(Math.max(0, centre - half) * 100)}–${Math.round(Math.min(1, centre + half) * 100)}%`;
}
const percentile = (values: number[], q: number) => {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
};
const seconds = (ms: number) => (Number.isNaN(ms) ? '—' : `${(ms / 1000).toFixed(1)} s`);
const count = (list: Trial[], outcome: Outcome) => list.filter((r) => r.outcome === outcome).length;
const healableKeys = new Set(CASES.filter((c) => c.truth).map((c) => c.key));

const setOf = new Map(CASES.map((c) => [c.key, c.set]));
const decoyCount = CASES.filter((c) => c.set === 'decoy').length;

function summaryRow(provider: string, mode: Mode, mine: Trial[]): string {
  const healableTrials = mine.filter((r) => healableKeys.has(r.key));
  const refusalTrials = mine.filter((r) => !healableKeys.has(r.key));
  const answered = mine.filter((r) => r.outcome !== 'error');
  const all = answered.flatMap((r) => r.candidates);
  const wrong = all.filter((c) => !c.right);
  const right = all.filter((c) => c.right);
  const correct = count(healableTrials, 'correct');
  const costs = answered.map((r) => r.costUsd).filter((c): c is number => c !== undefined);
  return (
    `| ${provider} | ${mode} | ${correct}/${healableTrials.length} (${wilson(correct, healableTrials.length)}) | **${count(mine, 'FALSE HEAL')}** | ${count(healableTrials, 'missed')} | ${count(refusalTrials, 'refused')}/${refusalTrials.length} | ${healableTrials.filter((r) => r.topRight).length}/${healableTrials.length} | ${wrong.filter((c) => !c.passed).length}/${wrong.length} | ${right.filter((c) => !c.passed).length}/${right.length} | ${answered.reduce((n, r) => n + r.malformed, 0)} | ${count(mine, 'error')} | ${seconds(percentile(answered.map((r) => r.ms), 0.5))} / ${seconds(percentile(answered.map((r) => r.ms), 0.95))} | ${costs.length ? `$${(costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(4)}` : '—'} |`
  );
}

const summaryRows: string[] = [];
const decoyRows: string[] = [];
const caseRows: string[] = [];
for (const provider of providers) {
  for (const mode of modes) {
    const mine = results.filter((r) => r.provider === provider.name && r.mode === mode);
    summaryRows.push(summaryRow(provider.name, mode, mine));
    decoyRows.push(summaryRow(provider.name, mode, mine.filter((r) => setOf.get(r.key) === 'decoy')));
    for (const c of CASES) {
      const runs = mine.filter((r) => r.key === c.key);
      const answers = runs.map((r) => r.accepted ?? `(${r.outcome})`);
      const modal = [...new Set(answers)].map((a) => [a, answers.filter((x) => x === a).length] as const).sort((a, b) => b[1] - a[1])[0];
      const outcomes = (['correct', 'FALSE HEAL', 'missed', 'refused', 'error'] as Outcome[]).filter((o) => count(runs, o)).map((o) => `${o} ${count(runs, o)}`).join(', ');
      caseRows.push(`| ${provider.name} | ${mode} | ${c.set} | \`${c.key}\` | ${outcomes} | ${modal ? `${modal[1]}/${runs.length}` : '—'} | ${modal ? `\`${modal[0].replaceAll('|', '\\|')}\`` : '—'} |`);
    }
  }
}

const falseHeals = results.filter((r) => r.outcome === 'FALSE HEAL');
const dir = path.join('self-healing', 'eval-results');
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
writeFileSync(
  path.join(dir, 'EVAL.md'),
  `# Self-healing evaluation

Run ${new Date().toISOString()} · \`npm run heal:eval -- --providers ${requested.join(',')} --modes ${modes.join(',')} --trials ${trials}\`

${CASES.length} cases, ${trials} trial(s) each, per provider and prompt condition: the exercise's five broken locators (four healable, one removed feature) and ${decoyCount} harder cases that exist only in this evaluation, where a plausible wrong element is on the page. A heal is **correct** only if the accepted locator resolves to the very element the healthy page objects in \`loanlens-ui/pages\` resolve to. A **false heal** is an accepted locator that finds anything else; it is the failure that matters, because it turns a test green for the wrong reason.

**Conditions.** *open*: the healer sees the declared fingerprint (role, name, container), as at runtime. *blind*: the fingerprint is withheld from the healer and used only by the validator.

## Summary

| Provider | Condition | Correct heals (95% CI) | False heals | Missed | Correct refusals | Top-1 right before validation | Wrong candidates rejected | Right candidates rejected | Malformed | Errors | Latency p50 / p95 | Cost per call |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${summaryRows.join('\n')}

- **Top-1 right before validation** scores the provider alone. The gap between that column and *Correct heals* is what the validator contributes, by rejecting a wrong first choice and falling through to a right one.
- **Wrong candidates rejected** is the validator's catch rate: of every candidate that pointed at the wrong element, how many it refused. **Right candidates rejected** is its over-strictness.
- The confidence interval is a 95% Wilson interval. With ${healableKeys.size} healable cases it is wide on purpose; this is a small fixed eval set, and the cases were written by the same person who wrote the healer.

## Decoy cases only

| Provider | Condition | Correct heals (95% CI) | False heals | Missed | Correct refusals | Top-1 right before validation | Wrong candidates rejected | Right candidates rejected | Malformed | Errors | Latency p50 / p95 | Cost per call |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${decoyRows.join('\n')}

- \`decoy.loanPrincipalValue\`: the loan's principal figure, with eight chart bars, a legend item and the figure's own group also named "Principal".
- \`decoy.reportsResetButton\`: "Clear all filters" was renamed "Reset", which shares no word with it, while "Apply filters" shares one.

## Per case

| Provider | Condition | Set | Locator | Outcomes | Agreement | Most frequent answer |
|---|---|---|---|---|---|---|
${caseRows.join('\n')}

*Agreement* is how many trials gave the most frequent answer: a measure of consistency across repeated calls, not of correctness.
${falseHeals.length ? `\n## False heals\n\n${falseHeals.map((r) => `- ${r.provider} (${r.mode}) on \`${r.key}\`, trial ${r.trial}: accepted \`${r.accepted}\``).join('\n')}\n` : ''}`,
);
console.log(`\n${results.length} trials, ${falseHeals.length} false heals. ${path.join(dir, 'EVAL.md')} written.`);
process.exit(falseHeals.length ? 1 : 0);
