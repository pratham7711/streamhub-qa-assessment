/**
 * Cucumber profiles, one per suite. Run them through `npm test` or
 * `node scripts/run-suite.mjs <suite>`, which set SUITE and REPORTS_DIR so every
 * report lands in <REPORTS_DIR>/<suite>/.
 */
const reports = process.env.REPORTS_DIR ?? 'test-results';
const FRAMEWORK = ['framework/support/**/*.ts', 'framework/steps/**/*.ts'];

const suite = (name, dirs, extra = {}) => ({
  paths: [`${dirs[0]}/features/**/*.feature`],
  import: [...FRAMEWORK, ...dirs.map((d) => `${d}/steps/**/*.ts`)],
  format: [
    'pretty',
    `html:${reports}/${name}/cucumber-report.html`,
    `json:${reports}/${name}/cucumber-report.json`,
    `junit:${reports}/${name}/junit.xml`,
    `rerun:${reports}/${name}/@rerun.txt`,
  ],
  formatOptions: { snippetInterface: 'async-await', junit: { suiteName: name } },
  ...extra,
});

const ALL = ['loanlens-api', 'emicalculator', 'self-healing', 'sql'];
export default {
  ...suite('adhoc', ALL),
  paths: ALL.map((d) => `${d}/features/**/*.feature`),
  tags: 'not @broken-locator',
};

export const loanlensApi = suite('loanlens-api', ['loanlens-api'], { parallel: 4 });
export const emicalculator = suite('emicalculator', ['emicalculator'], {
  parallel: 3,
  retry: 1,
  retryTagFilter: 'not @known-defect',
});
export const sql = suite('sql', ['sql']);
// The self-healing exercise drives emicalculator.net, so it reuses the emicalculator suite's steps.
export const selfHealing = suite('self-healing', ['self-healing', 'emicalculator']);
export const selfHealingHealed = suite('self-healing-healed', ['self-healing', 'emicalculator']);
