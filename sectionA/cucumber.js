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

const ALL = ['loanlens-ui', 'jsonplaceholder', 'self-healing', 'sql'];
export default {
  ...suite('adhoc', ALL),
  paths: ALL.map((d) => `${d}/features/**/*.feature`),
  tags: 'not @broken-locator',
};

export const loanlensUi = suite('loanlens-ui', ['loanlens-ui']);
export const jsonplaceholder = suite('jsonplaceholder', ['jsonplaceholder'], { parallel: 4 });
export const sql = suite('sql', ['sql']);
// The self-healing exercise drives the LoanLens web app, so it reuses the UI suite's steps.
export const selfHealing = suite('self-healing', ['self-healing', 'loanlens-ui']);
export const selfHealingHealed = suite('self-healing-healed', ['self-healing', 'loanlens-ui']);
