/**
 * Cucumber profiles, one per suite. Run them through `npm run test:section-a`,
 * `npm run test:section-b` or `node scripts/run-suite.mjs <suite>`, which set
 * SUITE and REPORTS_DIR so every report lands in <REPORTS_DIR>/<suite>/.
 *
 * Each suite loads the shared framework plus its own step definitions only, so
 * a Section A suite cannot depend on Section B code, or the other way round.
 */
const reports = process.env.REPORTS_DIR ?? 'reports';
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

const ALL = ['section-a/loanlens-ui', 'section-a/jsonplaceholder', 'section-a/self-healing', 'section-b/loanlens-api', 'section-b/emicalculator', 'section-b/self-healing', 'sql'];
export default {
  ...suite('adhoc', ALL),
  paths: ALL.map((d) => `${d}/features/**/*.feature`),
  tags: 'not @broken-locator',
};

// Section A
export const loanlensUi = suite('loanlens-ui', ['section-a/loanlens-ui']);
export const jsonplaceholder = suite('jsonplaceholder', ['section-a/jsonplaceholder'], { parallel: 4 });
// Section B
export const loanlensApi = suite('loanlens-api', ['section-b/loanlens-api'], { parallel: 4 });
export const emicalculator = suite('emicalculator', ['section-b/emicalculator'], {
  parallel: 3,
  retry: 1,
  retryTagFilter: 'not @known-defect',
});
// Both sections: A4 and B4 are the same SQL.
export const sql = suite('sql', ['sql']);
// Each section has its own self-healing exercise on its own UI pages, run by the shared healer
// (self-healing/). SECTION picks which one; scripts/run-all.mjs and `--section` set it.
const healing = { a: ['section-a/self-healing', 'section-a/loanlens-ui'], b: ['section-b/self-healing', 'section-b/emicalculator'] }[process.env.SECTION ?? 'a'];
if (!healing) throw new Error(`SECTION must be "a" or "b" (got "${process.env.SECTION}")`);
export const selfHealing = suite('self-healing', healing);
export const selfHealingHealed = suite('self-healing-healed', healing);
