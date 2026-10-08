#!/usr/bin/env node
/**
 * npm test: builds the web app, runs the three suites, and writes reports/SUMMARY.md.
 *
 * Two kinds of failure are expected, and are tagged so:
 *   jsonplaceholder  @known-defect    defects of the public API (jsonplaceholder/FINDINGS.md)
 *   self-healing     @broken-locator  the locators broken on purpose, run with healing off
 * A tagged scenario counts as expected only when it fails with that tag's own error: the API
 * answering an invalid post with something other than a 4xx, or a legacy locator's diagnosis.
 * A timeout, a network error or a bug in a step is unexpected even under the tag. Any
 * unexpected failure makes this script exit 1, as does a suite that wrote no report or ran
 * no scenarios. A tagged scenario that passes is listed, so a defect fixed upstream is noticed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const SUITES = [
  { suite: 'loanlens-ui', brief: 'A1/A2' },
  { suite: 'jsonplaceholder', brief: 'A3', expectedFailTag: '@known-defect', expectedError: /^Error: Expected a 4xx rejection .* but the API answered / },
  { suite: 'self-healing', brief: 'Self-healing', expectedFailTag: '@broken-locator', expectedError: /^Error: Locator "[\w.]+" failed: / },
];
const REPORTS = 'reports';

if (spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' }).status !== 0) {
  console.error('Web build failed; aborting.');
  process.exit(1);
}

const started = new Date();
const results = SUITES.map((run) => {
  console.log(`\n${'═'.repeat(72)}\n▶ ${run.suite}\n${'═'.repeat(72)}`);
  const t0 = Date.now();
  spawnSync(process.execPath, ['scripts/run-suite.mjs', run.suite], { stdio: 'inherit', env: { ...process.env, REPORTS_DIR: REPORTS } });
  const scenarios = readScenarios(run);
  return { ...run, seconds: (Date.now() - t0) / 1000, scenarios, unexpected: scenarios ? scenarios.filter((s) => s.failed && !s.expected).length : 1 };
});
const unexpected = results.reduce((n, r) => n + r.unexpected + (r.scenarios?.length === 0 ? 1 : 0), 0);

const rows = results.map((r) => {
  if (!r.scenarios?.length) return `| ${r.suite} | ${r.brief} | **${r.scenarios ? 'no scenarios ran' : 'no report'}** | | | | |`;
  const count = (f) => r.scenarios.filter(f).length;
  return `| ${r.suite} | ${r.brief} | ${r.scenarios.length} | ${count((s) => !s.failed)} | ${count((s) => s.expected)} | ${r.unexpected ? `**${r.unexpected}**` : 0} | ${r.seconds.toFixed(0)} s · [html](${r.suite}/cucumber-report.html) · [log](${r.suite}/console.log) |`;
});
const failed = results
  .filter((r) => r.scenarios?.some((s) => s.failed))
  .map((r) => `### ${r.suite}\n\n${r.scenarios.filter((s) => s.failed).map((s) => `- ${s.expected ? 'expected' : '**UNEXPECTED**'}: ${s.name} (\`${s.uri}\`)\n  - ${s.error.slice(0, 220)}`).join('\n')}`);
const taggedButPassed = results.flatMap((r) => (r.scenarios ?? []).filter((s) => s.taggedButPassed).map((s) => `- ${r.suite}: ${s.name} (\`${s.uri}\`)`));

mkdirSync(REPORTS, { recursive: true });
writeFileSync(
  `${REPORTS}/SUMMARY.md`,
  `# Section A test results

Run ${started.toISOString()} · \`npm test\` · node ${process.version} · TEST_ENV=${process.env.TEST_ENV ?? 'local'}

Red scenarios in the HTML reports are expected when they are tagged and fail for the tagged reason: a documented defect of the public JSONPlaceholder API (\`@known-defect\`, [FINDINGS.md](../jsonplaceholder/FINDINGS.md)) or a locator broken on purpose for the self-healing exercise (\`@broken-locator\`, [SELF_HEALING.md](../docs/SELF_HEALING.md)). Any other failure, including a timeout under one of those tags, is unexpected. The **Failed (unexpected)** column is the verdict.

| Suite | Brief | Scenarios | Passed | Failed (expected) | Failed (unexpected) | Time · reports |
|---|---|---|---|---|---|---|
${rows.join('\n')}

**Unexpected failures: ${unexpected}.**

## Failed scenarios

${failed.join('\n\n') || 'None.'}

## Tagged as expected to fail, but passed

A row here means a documented defect may have been fixed upstream.

${taggedButPassed.join('\n') || 'None.'}
`,
);
console.log(`\n${REPORTS}/SUMMARY.md written. Unexpected failures: ${unexpected}.`);
process.exit(unexpected ? 1 : 0);

function readScenarios({ suite, expectedFailTag, expectedError }) {
  const file = `${REPORTS}/${suite}/cucumber-report.json`;
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, 'utf8')).flatMap((feature) =>
    (feature.elements ?? []).map((el) => {
      const steps = [...(el.before ?? []), ...el.steps, ...(el.after ?? [])];
      const failed = steps.some((s) => s.result?.status !== 'passed' && s.result?.status !== 'skipped') || steps.every((s) => s.result?.status === 'skipped');
      const tagged = !!expectedFailTag && (el.tags ?? []).some((t) => t.name === expectedFailTag);
      const error = steps.find((s) => s.result?.status === 'failed')?.result?.error_message?.split('\n')[0] ?? '';
      return {
        name: el.name,
        uri: `${feature.uri}:${el.line}`,
        failed,
        expected: failed && tagged && expectedError.test(error),
        taggedButPassed: !failed && tagged,
        error,
      };
    }),
  );
}
