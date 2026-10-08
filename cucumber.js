/**
 * Cucumber profiles, one per suite. Run them through `npm test` or
 * `node scripts/run-suite.mjs <suite>`, which put every report in <REPORTS_DIR>/<suite>/.
 */
const reports = process.env.REPORTS_DIR ?? 'test-results';

const suite = (name, dirs, extra = {}) => ({
  paths: [`${dirs[0]}/features/**/*.feature`],
  import: ['framework/support/**/*.ts', ...dirs.map((d) => `${d}/steps/**/*.ts`)],
  format: ['pretty', `html:${reports}/${name}/cucumber-report.html`, `json:${reports}/${name}/cucumber-report.json`, `junit:${reports}/${name}/junit.xml`],
  formatOptions: { snippetInterface: 'async-await', junit: { suiteName: name } },
  ...extra,
});

export const loanlensUi = suite('loanlens-ui', ['loanlens-ui']);
export const jsonplaceholder = suite('jsonplaceholder', ['jsonplaceholder']);
// The self-healing exercise drives the LoanLens web app, so it reuses the UI suite's steps.
export const selfHealing = suite('self-healing', ['self-healing', 'loanlens-ui']);
export const selfHealingHealed = suite('self-healing-healed', ['self-healing', 'loanlens-ui']);
export default suite('adhoc', ['loanlens-ui', 'jsonplaceholder'], { paths: ['loanlens-ui/features/**/*.feature', 'jsonplaceholder/features/**/*.feature'] });
