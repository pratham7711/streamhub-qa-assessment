/**
 * Cucumber profiles, one per suite. Run them through `npm run test:<suite>`
 * (scripts/run-suite.mjs), which sets SUITE so every report lands in
 * reports/<suite>/ and tees the console output to reports/<suite>/console.log.
 */
const suite = (name, paths, extra = {}) => ({
  paths,
  import: ['tests/support/**/*.ts', 'tests/steps/**/*.ts'],
  format: [
    'pretty',
    `html:reports/${name}/cucumber-report.html`,
    `json:reports/${name}/cucumber-report.json`,
    `junit:reports/${name}/junit.xml`,
    `rerun:reports/${name}/@rerun.txt`,
  ],
  formatOptions: { snippetInterface: 'async-await', junit: { suiteName: name } },
  ...extra,
});

export default suite('adhoc', ['tests/features/**/*.feature'], { tags: 'not @broken-locator' });

export const loanlensUi = suite('loanlens-ui', ['tests/features/loanlens-ui/**/*.feature']);
export const loanlensApi = suite('loanlens-api', ['tests/features/loanlens-api/**/*.feature'], { parallel: 4 });
export const jsonplaceholder = suite('jsonplaceholder', ['tests/features/jsonplaceholder/**/*.feature'], { parallel: 4 });
export const emicalculator = suite('emicalculator', ['tests/features/emicalculator/**/*.feature'], {
  parallel: 3,
  retry: 1,
  retryTagFilter: 'not @known-defect',
});
export const sql = suite('sql', ['tests/features/sql/**/*.feature']);
export const selfHealing = suite('self-healing', ['tests/features/self-healing/**/*.feature']);
export const selfHealingHealed = suite('self-healing-healed', ['tests/features/self-healing/**/*.feature']);
