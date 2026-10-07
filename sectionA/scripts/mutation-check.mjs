#!/usr/bin/env node
/**
 * npm run test:mutation — proves the loanlens-ui suite (A2) can fail, and that removing duplicate
 * scenarios did not remove protection.
 *
 * Each mutant is a small, realistic bug planted in a temporary copy of this folder (the working
 * tree is never touched). loanlens-ui is run against the copy, and the scenarios that failed are
 * recorded. A mutant nobody kills is a gap in the tests, unless it is marked `equivalent` with
 * the reason it cannot change any observable result.
 *
 *   node scripts/mutation-check.mjs [mutant id ...]   optionally only some mutants
 *
 * Writes reports/mutation/SUMMARY.md. Exits 1 if a non-equivalent mutant survives or a run does
 * not complete (build failure, app not starting, fewer scenarios than the baseline).
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const PORT = process.env.MUTATION_PORT ?? '5091';

/** @type {{ id: string, what: string, file: string, edits: [string, string][], equivalent?: string }[]} */
const MUTANTS = [
  // Web server (app/server.ts)
  { id: 'S05', what: 'Pages may be framed (clickjacking)', file: 'app/server.ts',
    edits: [["; frame-ancestors 'none'\"", '"']] },
  { id: 'S07', what: "Inline scripts allowed by the CSP ('unsafe-inline')", file: 'app/server.ts',
    edits: [["script-src 'self';", "script-src 'self' 'unsafe-inline';"]] },
  { id: 'S10', what: 'Pages answer write methods (no 405)', file: 'app/server.ts',
    edits: [['app.use(getOnly);\n', '']] },

  // In-browser data layer over the mock JSON (app/src/data, rebuilt for each mutant)
  { id: 'D01', what: 'Monthly rate from a 360-day year', file: 'app/src/data/emi.ts',
    edits: [['  const r = annualRatePct / 12 / 100;\n  const growth', '  const r = (annualRatePct / 100 / 360) * 30.4375;\n  const growth']] },
  { id: 'D02', what: 'Decimal-places limit not enforced (fractions of a paisa)', file: 'app/src/data/query.ts',
    edits: [["spec.kind === 'number' && spec.decimals !== undefined &&", 'false &&']] },
  { id: 'D03', what: 'Monthly EMI inflow counts closed and pending loans too', file: 'app/src/data/loanBook.ts',
    edits: [[".filter((l) => l.status === 'active' || l.status === 'overdue')", '.filter(() => true)']] },
  { id: 'D04', what: 'Search made case-sensitive', file: 'app/src/data/loanBook.ts',
    edits: [['const q = (params.q as string | undefined)?.toLowerCase();', 'const q = params.q as string | undefined;']] },
  { id: 'D05', what: 'City filter ignored', file: 'app/src/data/loanBook.ts',
    edits: [['if (params.city && !(params.city as string[]).includes(loan.city)) return false;', '']] },
  { id: 'D06', what: 'Sort direction ignored (descending sorts ascend)', file: 'app/src/data/loanBook.ts',
    edits: [["const direction = sort.startsWith('-') ? -1 : 1;", 'const direction = 1;']] },

  // Web UI (rebuilt for each mutant)
  { id: 'U01', what: 'Text the number box cannot read ("--5") is ignored', file: 'app/src/pages/Calculator.tsx',
    edits: [['if (badInput[field]) errors[field]', 'if (false) errors[field]']] },
  { id: 'U02', what: 'Exponent notation ("1e6") read as a number', file: 'app/src/pages/Calculator.tsx',
    edits: [['else if (/e/i.test(text)) errors[field]', 'else if (false) errors[field]']] },
  { id: 'U03', what: 'A decimal page number ("1.5") treated as a page', file: 'app/src/pages/Reports.tsx',
    edits: [["const pageIsValid = rawPage === null || (/^\\d+$/.test(rawPage) && Number(rawPage) >= 1);", 'const pageIsValid = rawPage === null || Number(rawPage) >= 1;']] },
  { id: 'U04', what: 'The loan ID from the URL rendered as HTML (reflected XSS)', file: 'app/src/pages/LoanDetail.tsx',
    edits: [['? `“${id}” is not a valid loan ID. Loan IDs look like LN-1047.`', '? <span dangerouslySetInnerHTML={{ __html: `“${id}” is not a valid loan ID. Loan IDs look like LN-1047.` }} />']] },
  { id: 'U05', what: 'Rupee figures truncated instead of rounded', file: 'app/src/lib/format.ts',
    edits: [['  return rupees.format(Math.round(value));', '  return rupees.format(Math.floor(value));']] },
  { id: 'U06', what: 'Dates formatted in a US time zone (shows the day before)', file: 'app/src/lib/format.ts',
    edits: [["const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });", "const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/New_York' });"]] },
  { id: 'U07', what: 'Stacked bar segments drawn from the axis, not from the segment below', file: 'app/src/components/BarChart.tsx',
    edits: [['const h = y(stacked) - top;', 'const h = y(0) - top;']] },
  { id: 'U08', what: 'Tenure shown without its remaining months ("7 yr" for 90 months)', file: 'app/src/lib/format.ts',
    edits: [['  return rest ? `${years} yr ${rest} mo` : `${years} yr`;', '  return `${years} yr`;']] },
  { id: 'U10', what: 'A malformed escape in the loan URL crashes the page title', file: 'app/src/App.tsx',
    edits: [['`Loan ${safeDecode(pathname.slice(7))}`', '`Loan ${decodeURIComponent(pathname.slice(7))}`']] },
];

const SUITE = 'loanlens-ui';
const repo = process.cwd();
const only = process.argv.slice(2);
const unknown = only.filter((id) => !MUTANTS.some((m) => m.id === id));
if (unknown.length) {
  console.error(`No such mutant: ${unknown.join(', ')}`);
  process.exit(2);
}
const selected = MUTANTS.filter((m) => !only.length || only.includes(m.id));
const env = {
  ...process.env,
  TEST_ENV: 'local',
  WEB_PORT: PORT,
  WEB_BASE_URL: `http://localhost:${PORT}`,
  APP_AUTOSTART: 'true',
  REPORTS_DIR: 'reports',
  SCREENSHOTS: 'off',
  TRACE: 'off',
};

// run-suite reuses a healthy app already on its port, so a stray server there would answer
// every mutant with unmutated code and every mutant would "survive". Refuse instead.
const portFree = (port) =>
  new Promise((resolve) => {
    const probe = net.createServer().once('error', () => resolve(false)).once('listening', () => probe.close(() => resolve(true)));
    probe.listen(Number(port));
  });
if (!(await portFree(PORT))) {
  console.error(`Port ${PORT} is in use. Stop whatever is on it, or set MUTATION_PORT to a free port.`);
  process.exit(2);
}

const work = mkdtempSync(path.join(os.tmpdir(), 'loanlens-mutants-'));
const cleanUp = () => rmSync(work, { recursive: true, force: true });
process.once('SIGINT', () => {
  cleanUp();
  process.exit(130);
});

function build() {
  const res = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'app/vite.config.ts', '--logLevel', 'error'], { cwd: work, env, encoding: 'utf8' });
  return res.status === 0 ? undefined : `web build failed: ${(res.stderr || res.stdout).trim().slice(-400)}`;
}
const needsBuild = (m) => m.file.startsWith('app/src/');

/**
 * A scenario counts as having caught the mutant only if one of its steps or After hooks
 * failed. A failing Before hook means the scenario never ran (the app did not start, the
 * browser did not launch), which proves nothing about the tests.
 */
function runSuite(suite) {
  const started = Date.now();
  const res = spawnSync(process.execPath, ['scripts/run-suite.mjs', suite], { cwd: work, env, encoding: 'utf8' });
  const seconds = Math.round((Date.now() - started) / 1000);
  const reportFile = path.join(work, 'reports', suite, 'cucumber-report.json');
  if (!existsSync(reportFile)) return { error: `no report; the suite did not run: ${(res.stderr || res.stdout).trim().slice(-400)}`, failed: [], total: 0, seconds };
  const scenarios = JSON.parse(readFileSync(reportFile, 'utf8')).flatMap((f) => f.elements ?? []);
  // Cucumber's JSON lists hooks among the steps, as hidden entries with the keyword Before or After.
  const isBefore = (st) => st.hidden && st.keyword?.trim() === 'Before';
  const failedWhere = (sc, pick) => (sc.steps ?? []).some((st) => pick(st) && st.result?.status === 'failed');
  const broken = scenarios.filter((sc) => failedWhere(sc, isBefore)).map((sc) => sc.name);
  const failed = scenarios.filter((sc) => !failedWhere(sc, isBefore) && failedWhere(sc, (st) => !isBefore(st))).map((sc) => sc.name);
  return { error: broken.length ? `${broken.length} scenarios never ran (Before hook failed)` : undefined, failed: [...new Set(failed)], total: scenarios.length, seconds };
}

const results = [];
try {
  for (const entry of readdirSync(repo)) {
    if (['node_modules', 'reports', 'test-results'].includes(entry)) continue;
    cpSync(path.join(repo, entry), path.join(work, entry), { recursive: true, filter: (src) => !src.includes(`${path.sep}node_modules`) });
  }
  symlinkSync(path.join(repo, 'node_modules'), path.join(work, 'node_modules'));

  const baseBuildError = build();
  if (baseBuildError) throw new Error(`Unmutated copy: ${baseBuildError}`);

  console.log(`Mutant copy: ${work}`);
  const base = runSuite(SUITE);
  if (base.error || base.failed.length || !base.total) {
    throw new Error(`Baseline ${SUITE} is not green in the copy, so mutants would prove nothing: ${base.error ?? (base.failed.join('; ') || 'no scenarios ran')}`);
  }
  const baseline = base.total;
  console.log(`Baseline ${SUITE}: ${baseline} scenarios green (${base.seconds}s)`);

  for (const m of selected) {
    const target = path.join(work, m.file);
    const original = readFileSync(target, 'utf8');
    let mutated = original;
    for (const [find, replace] of m.edits) {
      const count = mutated.split(find).length - 1;
      if (count !== 1) throw new Error(`${m.id}: expected the snippet once in ${m.file}, found it ${count} times:\n${find}`);
      mutated = mutated.replace(find, replace);
    }
    writeFileSync(target, mutated);
    try {
      const buildError = needsBuild(m) ? build() : undefined;
      const run = buildError ? { error: buildError, failed: [], total: 0, seconds: 0 } : runSuite(SUITE);
      if (!run.error && run.total !== baseline) run.error = `${run.total} scenarios ran; the baseline had ${baseline}`;
      const status = run.error ? 'ERROR' : run.failed.length ? 'killed' : m.equivalent ? 'equivalent' : 'SURVIVED';
      results.push({ ...m, ...run, status });
      console.log(`${m.id} ${status.padEnd(10)} ${m.what} (${run.error ?? `${run.failed.length} failed`}, ${run.seconds}s)`);
    } finally {
      writeFileSync(target, original);
    }
    if (needsBuild(m)) {
      const restoreError = build();
      if (restoreError) throw new Error(`Rebuilding after ${m.id}: ${restoreError}`);
    }
  }
} finally {
  cleanUp();
}

const cell = (s) => s.replaceAll('|', '\\|');
const caughtBy = (r) =>
  r.status === 'killed' ? `${r.failed.length}: ${cell(r.failed.slice(0, 3).join('; '))}${r.failed.length > 3 ? '; …' : ''}` : cell(r.error ?? r.equivalent ?? 'none');
const t = {
  killed: results.filter((r) => r.status === 'killed').length,
  equivalent: results.filter((r) => r.status === 'equivalent').length,
  survived: results.filter((r) => r.status === 'SURVIVED').length,
  errored: results.filter((r) => r.status === 'ERROR').length,
};
const command = `npm run test:mutation${only.length ? ` -- ${only.join(' ')}` : ''}`;
const lines = [
  '# Mutation check, Section A',
  '',
  `Run ${new Date().toISOString()} · node ${process.version} · \`${command}\``,
  '',
  `Each mutant is a small, realistic bug, written by hand and planted in a temporary copy of the LoanLens web app. The suite that owns that code (${SUITE}, A2) is run against the copy. A mutant counts as killed only if the run completed with the baseline's scenario count and at least one step or After-hook assertion failed. **${t.killed} of ${results.length} killed**, ${t.equivalent} equivalent, **${t.survived} survived**, ${t.errored} did not run cleanly.`,
  '',
  '| Mutant | Planted bug | Result | Scenarios that caught it |',
  '|---|---|---|---|',
  ...results.map((r) => `| ${r.id} | ${cell(r.what)} | ${r.status} | ${caughtBy(r)} |`),
  '',
];
const dir = path.join(repo, 'reports', 'mutation');
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, 'SUMMARY.md'), lines.join('\n'));
console.log(`${t.killed}/${results.length} killed, ${t.equivalent} equivalent, ${t.survived} survived, ${t.errored} errored. reports/mutation/SUMMARY.md written.`);
process.exit(t.survived || t.errored ? 1 : 0);
