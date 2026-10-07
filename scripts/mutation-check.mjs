#!/usr/bin/env node
/**
 * npm run test:mutation — proves the LoanLens suites can fail, and that removing duplicate
 * scenarios did not remove protection.
 *
 * Each mutant is a small, realistic bug planted in a temporary copy of the repo (the working
 * tree is never touched). The suite that should notice it is run against the copy, and the
 * scenarios that failed are recorded. A mutant nobody kills is a gap in the tests, unless it is
 * marked `equivalent` with the reason it cannot change any observable result.
 *
 * Each mutant belongs to the section whose suite should catch it: loanlens-ui (A2) is
 * Section A, loanlens-api (B2) is Section B. `--section a|b` runs one section's mutants;
 * mutant IDs run a subset. Writes section-<a|b>/reports/mutation/SUMMARY.md for each section
 * that ran. Exits 1 if a non-equivalent mutant survives or a run does not complete (build
 * failure, app not starting, fewer scenarios than the baseline).
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const PORT = process.env.MUTATION_PORT ?? '5091';

/** @type {{ id: string, what: string, file: string, edits: [string, string][], suite: 'loanlens-api' | 'loanlens-ui', equivalent?: string }[]} */
const MUTANTS = [
  // Query parsing (app/server/lib/query.ts)
  { id: 'Q01', what: 'Numbers parsed with Number() instead of a strict pattern', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [['if (!pattern.test(text)) {', 'if (!Number.isFinite(Number(text))) {']] },
  { id: 'Q02', what: 'Numbers parsed with parseFloat()', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [['if (!pattern.test(text)) {', 'if (Number.isNaN(parseFloat(text))) {'], ['const num = Number(text);', 'const num = parseFloat(text);']] },
  { id: 'Q03', what: 'Number pattern not anchored at the end', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [['const NUMERIC = /^-?\\d+(\\.\\d+)?$/;', 'const NUMERIC = /^-?\\d+(\\.\\d+)?/;']] },
  { id: 'Q04', what: 'A leading plus sign accepted', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [['const NUMERIC = /^-?\\d+(\\.\\d+)?$/;', 'const NUMERIC = /^[-+]?\\d+(\\.\\d+)?$/;']] },
  { id: 'Q05', what: 'The sign dropped with Math.abs (emicalculator.net defect EC-01)', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [['const num = Number(text);', 'const num = Math.abs(Number(text));']] },
  { id: 'Q06', what: 'Minimum made exclusive (off by one)', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [['num < spec.min)', 'num <= spec.min)']] },
  { id: 'Q07', what: 'Maximum made exclusive (off by one)', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [['num > spec.max))', 'num >= spec.max))']] },
  { id: 'Q08', what: 'Decimal-places limit not enforced (fractions of a paisa)', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [["spec.kind === 'number' && spec.decimals !== undefined &&", 'false &&']] },
  { id: 'Q09', what: 'Values not trimmed before validation', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [['const text = input.trim();', 'const text = input;']] },
  { id: 'Q10', what: 'Unknown-parameter check uses `in` (lets __proto__ and constructor through)', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [['if (!Object.hasOwn(schema, key)) {', 'if (!(key in schema)) {']] },
  { id: 'Q11', what: 'Unknown parameters silently ignored', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [['if (!Object.hasOwn(schema, key)) {', 'if (false) {']] },
  { id: 'Q12', what: 'A parameter given twice: the first value wins (HTTP parameter pollution)', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [["        details.push({ param, issue: 'duplicate_parameter', message: `\"${param}\" may only be given once`, received: input });\n        continue;", '        input = [input[0]];']] },
  { id: 'Q13', what: 'A list filter accepted when only some values are valid', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [['if (bad.length || !items.length) {', 'if (bad.length === items.length) {']] },
  { id: 'Q14', what: 'Dates checked by pattern only (2023-02-29 accepted)', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [["const valid = ISO_DATE.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`)) && new Date(`${text}T00:00:00Z`).toISOString().startsWith(text);", 'const valid = ISO_DATE.test(text);']] },
  { id: 'Q15', what: 'Sort strips every leading minus (--amount accepted)', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [["const field = text.startsWith('-') ? text.slice(1) : text;", "const field = text.replace(/^-+/, '');"]] },
  { id: 'Q16', what: 'Integer parameters accept decimals', file: 'app/server/lib/query.ts', suite: 'loanlens-api',
    edits: [['const INTEGER = /^-?\\d+$/;', 'const INTEGER = /^-?\\d+(\\.\\d+)?$/;']] },

  // EMI route and maths
  { id: 'E01', what: 'Tenure not required to be a whole number of months', file: 'app/server/routes/emi.ts', suite: 'loanlens-api',
    edits: [['!Number.isInteger(months) || ', '']] },
  { id: 'E02', what: 'Tenure message prints raw floating point ("1.2000000000000002 months")', file: 'app/server/routes/emi.ts', suite: 'loanlens-api',
    edits: [['(got ${Math.round(months * 100) / 100} months)', '(got ${months} months)']] },
  { id: 'E03', what: '480-month limit made exclusive', file: 'app/server/routes/emi.ts', suite: 'loanlens-api',
    edits: [['months > TENURE_LIMIT_MONTHS', 'months >= TENURE_LIMIT_MONTHS']] },
  { id: 'E04', what: 'No special case for a 0% rate (0/0)', file: 'app/server/lib/emi.ts', suite: 'loanlens-api',
    edits: [['  if (annualRatePct === 0) return principal / months;\n', '']] },
  { id: 'E05', what: 'Monthly rate from a 360-day year', file: 'app/server/lib/emi.ts', suite: 'loanlens-api',
    edits: [['  const r = annualRatePct / 12 / 100;\n  const growth', '  const r = (annualRatePct / 100 / 360) * 30.4375;\n  const growth']] },
  { id: 'E06', what: 'Payments grouped into the wrong calendar year', file: 'app/server/lib/emi.ts', suite: 'loanlens-api',
    edits: [['startYear + Math.floor((startMonth - 1 + k) / 12)', 'startYear + Math.floor((startMonth + k) / 12)']] },
  { id: 'E07', what: 'Last instalment not adjusted to clear the balance', file: 'app/server/lib/emi.ts', suite: 'loanlens-api',
    edits: [['k === months - 1 ? balance : emi - interest', 'emi - interest']] },
  { id: 'E08', what: 'Totals rounded to whole rupees instead of paise', file: 'app/server/lib/emi.ts', suite: 'loanlens-api',
    edits: [['    totalInterest: round2(totalPayment - principal),\n    totalPayment: round2(totalPayment),', '    totalInterest: Math.round(totalPayment - principal),\n    totalPayment: Math.round(totalPayment),']] },
  // E09-E11 agree with their own echo of the inputs, so only an oracle built from the request catches them.
  { id: 'E09', what: 'Tenure units swapped (years read as months)', file: 'app/server/routes/emi.ts', suite: 'loanlens-api',
    edits: [["const months = params.tenureUnit === 'years' ? tenure * 12 : tenure;", "const months = params.tenureUnit === 'months' ? tenure * 12 : tenure;"]] },
  { id: 'E10', what: 'Default start month off by one (getMonth() is zero-based)', file: 'app/server/routes/emi.ts', suite: 'loanlens-api',
    edits: [[': [now.getFullYear(), now.getMonth() + 1];', ': [now.getFullYear(), now.getMonth()];']] },
  { id: 'E11', what: 'Start month echoed without zero padding ("2026-1")', file: 'app/server/routes/emi.ts', suite: 'loanlens-api',
    edits: [["startMonth: `${startYear}-${String(startMonth).padStart(2, '0')}`", 'startMonth: `${startYear}-${startMonth}`']] },

  // Loan list, summary and single loan (app/server/routes/loans.ts)
  { id: 'L01', what: 'Search made case-sensitive', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [['const q = (params.q as string | undefined)?.toLowerCase();', 'const q = params.q as string | undefined;']] },
  { id: 'L02', what: 'Search text treated as a regular expression', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [['!loan.borrower.toLowerCase().includes(q)', '!new RegExp(q).test(loan.borrower.toLowerCase())']] },
  { id: 'L03', what: 'Minimum amount made exclusive', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [['loan.amount < (params.minAmount as number)', 'loan.amount <= (params.minAmount as number)']] },
  { id: 'L04', what: 'Inverted rate band not rejected', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [["  assertOrdered(params, 'minRate', 'maxRate');\n", '']] },
  { id: 'L05', what: 'Monthly EMI inflow counts closed and pending loans too', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [[".filter((l) => l.status === 'active' || l.status === 'overdue')", '.filter(() => true)']] },
  { id: 'L06', what: 'Weighted rate divides by zero when nothing matches', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [['weightedAverageRate: totalPrincipal ? round2(sum(loans.map((l) => l.amount * l.rate)) / totalPrincipal) : 0,', 'weightedAverageRate: round2(sum(loans.map((l) => l.amount * l.rate)) / totalPrincipal),']] },
  { id: 'L07', what: 'Summary accepts the list’s paging and sorting', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [['const params = parseQuery(req, filterSchema);', 'const params = parseQuery(req, listSchema);']] },
  { id: 'L08', what: 'Loan ID pattern made case-insensitive', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [['const LOAN_ID = /^LN-\\d{4}$/;', 'const LOAN_ID = /^LN-\\d{4}$/i;']] },
  { id: 'L09', what: 'Loan ID pattern not anchored at the end', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [['const LOAN_ID = /^LN-\\d{4}$/;', 'const LOAN_ID = /^LN-\\d{4}/;']] },
  { id: 'L11', what: 'Monthly EMI inflow rounded to whole rupees', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [['monthlyEmiInflow: round2(sum(', 'monthlyEmiInflow: Math.round(sum(']] },
  { id: 'L12', what: 'Minimum rate made exclusive', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [['loan.rate < (params.minRate as number)', 'loan.rate <= (params.minRate as number)']] },
  { id: 'L13', what: 'End date made exclusive', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [['loan.disbursedOn > (params.disbursedTo as string)', 'loan.disbursedOn >= (params.disbursedTo as string)']] },
  { id: 'L14', what: 'Each loan\'s EMI truncated to the paisa instead of rounded', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [['emi: Math.round(monthlyEmi(loan.amount, loan.rate, loan.tenureMonths) * 100) / 100', 'emi: Math.floor(monthlyEmi(loan.amount, loan.rate, loan.tenureMonths) * 100) / 100']] },
  { id: 'L10', what: 'An empty result reports 0 pages', file: 'app/server/routes/loans.ts', suite: 'loanlens-api',
    edits: [['const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));', 'const totalPages = Math.ceil(sorted.length / pageSize);']] },

  // Server hardening (app/server/app.ts, app/server/lib/errors.ts)
  { id: 'S01', what: 'Broken percent-encoding reaches the generic 500 handler', file: 'app/server/lib/errors.ts', suite: 'loanlens-api',
    edits: [['  if (err instanceof URIError) {', '  if (false) {']] },
  { id: 'S02', what: 'X-Content-Type-Options: nosniff removed', file: 'app/server/app.ts', suite: 'loanlens-api',
    edits: [["      'X-Content-Type-Options': 'nosniff',\n", '']] },
  { id: 'S03', what: 'Write methods reach the router', file: 'app/server/app.ts', suite: 'loanlens-api',
    edits: [['  app.use(getOnly);\n', '']] },
  { id: 'S04', what: 'CORS opened to every origin', file: 'app/server/app.ts', suite: 'loanlens-api',
    edits: [["      'Referrer-Policy': 'no-referrer',\n", "      'Referrer-Policy': 'no-referrer',\n      'Access-Control-Allow-Origin': '*',\n"]] },
  { id: 'S05', what: 'Pages may be framed (clickjacking)', file: 'app/server/app.ts', suite: 'loanlens-ui',
    edits: [["; frame-ancestors 'none'\"", '"']] },
  { id: 'S06', what: 'X-Powered-By: Express announced again (server fingerprint)', file: 'app/server/app.ts', suite: 'loanlens-api',
    edits: [["  app.disable('x-powered-by');\n", '']] },
  { id: 'S07', what: "Inline scripts allowed by the CSP ('unsafe-inline')", file: 'app/server/app.ts', suite: 'loanlens-ui',
    edits: [["script-src 'self';", "script-src 'self' 'unsafe-inline';"]] },
  { id: 'S08', what: 'API responses cacheable (no-store removed)', file: 'app/server/app.ts', suite: 'loanlens-api',
    edits: [["res.set('Cache-Control', 'no-store');", '']] },
  { id: 'S09', what: 'No cap on the number of query parameters', file: 'app/server/app.ts', suite: 'loanlens-api',
    edits: [['  api.use(limitQueryParameters);\n', '']] },
  { id: 'S10', what: 'Write methods refused under /api only; pages answer them', file: 'app/server/app.ts', suite: 'loanlens-ui',
    edits: [['  app.use(getOnly);\n', ''], ['  api.use(limitQueryParameters);\n', '  api.use(limitQueryParameters);\n  api.use(getOnly);\n']] },
  { id: 'S11', what: 'A city left out of the filter vocabulary', file: 'app/server/app.ts', suite: 'loanlens-api',
    edits: [['cities: CITIES }', 'cities: CITIES.slice(1) }']] },

  // Web UI (rebuilt for each mutant)
  { id: 'U01', what: 'Text the number box cannot read ("--5") is ignored', file: 'app/web/src/pages/Calculator.tsx', suite: 'loanlens-ui',
    edits: [['if (badInput[field]) errors[field]', 'if (false) errors[field]']] },
  { id: 'U02', what: 'Exponent notation ("1e6") sent to the API as a number', file: 'app/web/src/pages/Calculator.tsx', suite: 'loanlens-ui',
    edits: [['else if (/e/i.test(text)) errors[field]', 'else if (false) errors[field]']] },
  { id: 'U03', what: 'A decimal page number ("1.5") treated as a page', file: 'app/web/src/pages/Reports.tsx', suite: 'loanlens-ui',
    edits: [["const pageIsValid = rawPage === null || (/^\\d+$/.test(rawPage) && Number(rawPage) >= 1);", 'const pageIsValid = rawPage === null || Number(rawPage) >= 1;']] },
  { id: 'U04', what: 'The loan ID from the URL rendered as HTML (reflected XSS)', file: 'app/web/src/pages/LoanDetail.tsx', suite: 'loanlens-ui',
    edits: [['? `“${id}” is not a valid loan ID. Loan IDs look like LN-1047.`', '? <span dangerouslySetInnerHTML={{ __html: `“${id}” is not a valid loan ID. Loan IDs look like LN-1047.` }} />']] },
  { id: 'U05', what: 'Rupee figures truncated instead of rounded', file: 'app/web/src/lib/format.ts', suite: 'loanlens-ui',
    edits: [['  return rupees.format(Math.round(value));', '  return rupees.format(Math.floor(value));']] },
  { id: 'U06', what: 'Dates formatted in a US time zone (shows the day before)', file: 'app/web/src/lib/format.ts', suite: 'loanlens-ui',
    edits: [["const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });", "const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/New_York' });"]] },
  { id: 'U07', what: 'Stacked bar segments drawn from the axis, not from the segment below', file: 'app/web/src/components/BarChart.tsx', suite: 'loanlens-ui',
    edits: [['const h = y(stacked) - top;', 'const h = y(0) - top;']] },
  { id: 'U08', what: 'Tenure shown without its remaining months ("7 yr" for 90 months)', file: 'app/web/src/lib/format.ts', suite: 'loanlens-ui',
    edits: [['  return rest ? `${years} yr ${rest} mo` : `${years} yr`;', '  return `${years} yr`;']] },
  { id: 'U10', what: 'A malformed escape in the loan URL crashes the page title', file: 'app/web/src/App.tsx', suite: 'loanlens-ui',
    edits: [['`Loan ${safeDecode(pathname.slice(7))}`', '`Loan ${decodeURIComponent(pathname.slice(7))}`']] },
];

const SECTION_OF = { 'loanlens-ui': 'a', 'loanlens-api': 'b' };
const repo = process.cwd();
const args = process.argv.slice(2);
const sectionArg = args.includes('--section') ? args[args.indexOf('--section') + 1] : undefined;
if (sectionArg !== undefined && !['a', 'b'].includes(sectionArg)) {
  console.error('--section must be "a" or "b"');
  process.exit(2);
}
const only = args.filter((a, i) => a !== '--section' && args[i - 1] !== '--section');
const selected = MUTANTS.filter((m) => (!only.length || only.includes(m.id)) && (!sectionArg || SECTION_OF[m.suite] === sectionArg));
const env = {
  ...process.env,
  TEST_ENV: 'local',
  APP_PORT: PORT,
  APP_BASE_URL: `http://localhost:${PORT}`,
  APP_API_URL: `http://localhost:${PORT}/api`,
  APP_AUTOSTART: 'true',
  REPORTS_DIR: 'reports',
  SCREENSHOTS: 'off',
  TRACE: 'off',
};

// run-suite reuses a healthy app already on the port, so a stray server there would answer
// every mutant with unmutated code and every mutant would "survive". Refuse instead.
const portFree = await new Promise((resolve) => {
  const probe = net.createServer().once('error', () => resolve(false)).once('listening', () => probe.close(() => resolve(true)));
  probe.listen(Number(PORT));
});
if (!portFree) {
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
  const res = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'app/web/vite.config.ts', '--logLevel', 'error'], { cwd: work, env, encoding: 'utf8' });
  return res.status === 0 ? undefined : `web build failed: ${(res.stderr || res.stdout).trim().slice(-400)}`;
}

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
    if (['node_modules', 'reports', '.git'].includes(entry)) continue;
    const skip = (src) => src.includes(`${path.sep}node_modules`) || /[\\/]section-[ab][\\/]reports([\\/]|$)/.test(src);
    cpSync(path.join(repo, entry), path.join(work, entry), { recursive: true, filter: (src) => !skip(src) });
  }
  symlinkSync(path.join(repo, 'node_modules'), path.join(work, 'node_modules'));

  const needsUi = selected.some((m) => m.suite === 'loanlens-ui');
  const baseBuildError = needsUi ? build() : undefined;
  if (baseBuildError) throw new Error(`Unmutated copy: ${baseBuildError}`);

  console.log(`Mutant copy: ${work}`);
  const baseline = {};
  for (const suite of new Set(selected.map((m) => m.suite))) {
    const base = runSuite(suite);
    if (base.error || base.failed.length || !base.total) {
      throw new Error(`Baseline ${suite} is not green in the copy, so mutants would prove nothing: ${base.error ?? (base.failed.join('; ') || 'no scenarios ran')}`);
    }
    baseline[suite] = base.total;
    console.log(`Baseline ${suite}: ${base.total} scenarios green (${base.seconds}s)`);
  }

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
      const buildError = m.file.startsWith('app/web/') ? build() : undefined;
      const run = buildError ? { error: buildError, failed: [], total: 0, seconds: 0 } : runSuite(m.suite);
      if (!run.error && run.total !== baseline[m.suite]) run.error = `${run.total} scenarios ran; the baseline had ${baseline[m.suite]}`;
      const status = run.error ? 'ERROR' : run.failed.length ? 'killed' : m.equivalent ? 'equivalent' : 'SURVIVED';
      results.push({ ...m, ...run, status });
      console.log(`${m.id} ${status.padEnd(10)} ${m.what} (${run.error ?? `${run.failed.length} failed`}, ${run.seconds}s)`);
    } finally {
      writeFileSync(target, original);
    }
    if (m.file.startsWith('app/web/')) {
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
const tally = (rs) => ({
  killed: rs.filter((r) => r.status === 'killed').length,
  equivalent: rs.filter((r) => r.status === 'equivalent').length,
  survived: rs.filter((r) => r.status === 'SURVIVED').length,
  errored: rs.filter((r) => r.status === 'ERROR').length,
});
for (const section of ['a', 'b']) {
  const rs = results.filter((r) => SECTION_OF[r.suite] === section);
  if (!rs.length) continue;
  const t = tally(rs);
  const command = `npm run test:mutation -- --section ${section}${only.length ? ` ${only.join(' ')}` : ''}`;
  const lines = [
    `# Mutation check, Section ${section.toUpperCase()}`,
    '',
    `Run ${new Date().toISOString()} · node ${process.version} · \`${command}\``,
    '',
    `Each mutant is a small, realistic bug, written by hand and planted in a temporary copy of LoanLens. The suite that owns that code (${section === 'a' ? 'loanlens-ui, A2' : 'loanlens-api, B2'}) is run against the copy. A mutant counts as killed only if the run completed with the baseline's scenario count and at least one step or After-hook assertion failed. **${t.killed} of ${rs.length} killed**, ${t.equivalent} equivalent, **${t.survived} survived**, ${t.errored} did not run cleanly.`,
    '',
    '| Mutant | Planted bug | Suite | Result | Scenarios that caught it |',
    '|---|---|---|---|---|',
    ...rs.map((r) => `| ${r.id} | ${cell(r.what)} | ${r.suite} | ${r.status} | ${caughtBy(r)} |`),
    '',
  ];
  const dir = path.join(repo, `section-${section}`, 'reports', 'mutation');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SUMMARY.md'), lines.join('\n'));
  console.log(`Section ${section.toUpperCase()}: ${t.killed}/${rs.length} killed, ${t.equivalent} equivalent, ${t.survived} survived, ${t.errored} errored. ${path.relative(repo, dir)}/SUMMARY.md written.`);
}
const total = tally(results);
process.exit(total.survived || total.errored ? 1 : 0);
