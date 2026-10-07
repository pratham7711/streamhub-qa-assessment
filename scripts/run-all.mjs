#!/usr/bin/env node
/**
 * npm run test:all — builds the web app, runs every suite, and writes
 * reports/SUMMARY.md with per-suite results.
 *
 * Some failures are the point of a suite and are expected:
 *   jsonplaceholder  @known-defect   documented defects of the public API (docs/jsonplaceholder-findings.md)
 *   emicalculator    @known-defect   input-handling defects of the live site (docs/emicalculator-findings.md)
 *   self-healing     @broken-locator locators broken on purpose, run with healing off
 *   self-healing-healed  @unhealable  the removed-feature locator, which a correct healer refuses to fix
 * Any other failure is unexpected and makes this script exit 1, as does a suite that
 * produced no report or ran no scenarios (a broken tag filter or glob looks green otherwise).
 * A tagged scenario that passes is listed in SUMMARY.md, so a defect fixed upstream is noticed.
 *
 * `node scripts/run-all.mjs <suite> ...` runs only the named suites.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const healProvider = process.env.HEAL_PROVIDER ?? 'auto';
const RUNS = [
  { suite: 'loanlens-api', cmd: ['scripts/run-suite.mjs', 'loanlens-api'] },
  { suite: 'loanlens-ui', cmd: ['scripts/run-suite.mjs', 'loanlens-ui'] },
  { suite: 'sql', cmd: ['scripts/run-suite.mjs', 'sql'] },
  { suite: 'jsonplaceholder', cmd: ['scripts/run-suite.mjs', 'jsonplaceholder'], expectedFailTag: '@known-defect' },
  { suite: 'emicalculator', cmd: ['scripts/run-suite.mjs', 'emicalculator'], expectedFailTag: '@known-defect' },
  { suite: 'self-healing', cmd: ['scripts/run-suite.mjs', 'self-healing'], expectedFailTag: '@broken-locator', env: { SELF_HEAL: 'off' } },
  { suite: 'self-healing-healed', cmd: ['--import', 'tsx', 'self-healing/cli.ts', '--provider', healProvider], expectedFailTag: '@unhealable' },
];
const only = process.argv.slice(2);
const started = new Date();

const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
if (build.status !== 0) {
  console.error('Web build failed; aborting.');
  process.exit(1);
}

const rows = [];
for (const run of RUNS.filter((r) => !only.length || only.includes(r.suite))) {
  console.log(`\n${'═'.repeat(72)}\n▶ ${run.suite}\n${'═'.repeat(72)}`);
  const t0 = Date.now();
  const res = spawnSync(process.execPath, run.cmd, { stdio: 'inherit', env: { ...process.env, ...run.env } });
  rows.push({ ...run, exitCode: res.status, wallMs: Date.now() - t0, ...summarise(run) });
}

function summarise({ suite, expectedFailTag }) {
  const file = `reports/${suite}/cucumber-report.json`;
  if (!existsSync(file)) return { crashed: true, scenarios: [] };
  const features = JSON.parse(readFileSync(file, 'utf8'));
  const byId = new Map();
  for (const feature of features) {
    for (const el of feature.elements ?? []) {
      if (el.type !== 'scenario') continue;
      const steps = [...(el.before ?? []), ...el.steps, ...(el.after ?? [])];
      const failed = steps.some((s) => ['failed', 'undefined', 'ambiguous', 'pending'].includes(s.result?.status));
      const tags = (el.tags ?? []).map((t) => t.name);
      // With retries the JSON report repeats an attempt; keep the last one per scenario.
      byId.set(`${feature.uri}:${el.line}`, {
        name: el.name,
        uri: `${feature.uri}:${el.line}`,
        failed,
        expected: failed && !!expectedFailTag && tags.includes(expectedFailTag),
        // A scenario tagged as an expected failure that passed: the defect may have been fixed upstream.
        taggedButPassed: !failed && !!expectedFailTag && tags.includes(expectedFailTag),
        // Gherkin steps only: the JSON also lists each Before/After hook as a hidden step.
        steps: el.steps.filter((s) => !s.hidden).length,
        error: steps.find((s) => s.result?.status === 'failed')?.result?.error_message?.split('\n')[0] ?? '',
      });
    }
  }
  return { crashed: false, scenarios: [...byId.values()] };
}

const totals = rows.map((r) => {
  const passed = r.scenarios.filter((s) => !s.failed).length;
  const expectedFail = r.scenarios.filter((s) => s.expected).length;
  const unexpectedFail = r.scenarios.filter((s) => s.failed && !s.expected).length;
  const steps = r.scenarios.reduce((n, s) => n + s.steps, 0);
  return { ...r, passed, expectedFail, unexpectedFail, steps };
});
const empty = (r) => !r.crashed && r.scenarios.length === 0;
const unexpected = totals.reduce((n, r) => n + r.unexpectedFail + (r.crashed || empty(r) ? 1 : 0), 0);

const table = totals
  .map((r) =>
    r.crashed || empty(r)
      ? `| ${r.suite} | ${r.crashed ? '—' : 0} | — | — | **${r.crashed ? `no report (exit ${r.exitCode})` : 'no scenarios ran'}** | — | ${(r.wallMs / 1000).toFixed(0)} s | — |`
      : `| ${r.suite} | ${r.scenarios.length} | ${r.passed} | ${r.expectedFail} | ${r.unexpectedFail ? `**${r.unexpectedFail}**` : 0} | ${r.steps} | ${(r.wallMs / 1000).toFixed(0)} s | [html](${r.suite}/cucumber-report.html) · [log](${r.suite}/console.log) |`,
  )
  .join('\n');
const taggedButPassed = totals.flatMap((r) => r.scenarios.filter((s) => s.taggedButPassed).map((s) => `- ${r.suite}: ${s.name} (\`${s.uri}\`), tagged \`${r.expectedFailTag}\``));
const detail = totals
  .filter((r) => r.scenarios.some((s) => s.failed))
  .map((r) => `### ${r.suite}\n\n${r.scenarios.filter((s) => s.failed).map((s) => `- ${s.expected ? 'expected' : '**UNEXPECTED**'}: ${s.name} (\`${s.uri}\`)${s.error ? `\n  - ${s.error.slice(0, 220)}` : ''}`).join('\n')}`)
  .join('\n\n');

writeFileSync(
  'reports/SUMMARY.md',
  `# Test results

Run ${started.toISOString()} · node ${process.version} · TEST_ENV=${process.env.TEST_ENV ?? 'local'} · heal provider: ${healProvider}${only.length ? ` · suites: ${only.join(', ')}` : ''}

${totals.some((r) => r.expectedFail) ? '> Some HTML reports below show red scenarios. Those are expected failures: each one is a documented defect in a third-party site, or a locator broken on purpose for the self-healing demo. The **Failed (unexpected)** column is the verdict.\n' : ''}
| Suite | Scenarios | Passed | Failed (expected) | Failed (unexpected) | Gherkin steps | Wall time | Reports |
|---|---|---|---|---|---|---|---|
${table}

**Unexpected failures: ${unexpected}.** Expected failures are documented defects of the public JSONPlaceholder API and of emicalculator.net's input handling (\`@known-defect\`, see [docs/jsonplaceholder-findings.md](../docs/jsonplaceholder-findings.md) and [docs/emicalculator-findings.md](../docs/emicalculator-findings.md)), and the deliberately broken locators run with healing off (\`@broken-locator\`, see [docs/SELF_HEALING.md](../docs/SELF_HEALING.md)).

## Failed scenarios

${detail || 'None.'}

## Tagged as expected to fail, but passed

A row here means the documented defect may have been fixed upstream: check it by hand, then drop the tag and move the row to the passing set.

${taggedButPassed.join('\n') || 'None.'}
`,
);
console.log(`\n${'═'.repeat(72)}\nreports/SUMMARY.md written. Unexpected failures: ${unexpected}. Tagged as expected to fail but passed: ${taggedButPassed.length}`);
process.exit(unexpected ? 1 : 0);
