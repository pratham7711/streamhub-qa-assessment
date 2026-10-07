#!/usr/bin/env node
/**
 * npm run test:mutation — proves the loanlens-api suite (B2) can fail, and that removing duplicate
 * scenarios did not remove protection.
 *
 * Each mutant is a small, realistic bug planted in a temporary copy of this folder (the working
 * tree is never touched). loanlens-api is run against the copy, and the scenarios that failed are
 * recorded. A mutant nobody kills is a gap in the tests, unless it is marked `equivalent` with
 * the reason it cannot change any observable result.
 *
 *   node scripts/mutation-check.mjs [mutant id ...]   optionally only some mutants
 *
 * Writes reports/mutation/SUMMARY.md. Exits 1 if a non-equivalent mutant survives or a run does
 * not complete (app not starting, fewer scenarios than the baseline).
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const PORT = process.env.MUTATION_PORT ?? '5092';

/** @type {{ id: string, what: string, file: string, edits: [string, string][], equivalent?: string }[]} */
const MUTANTS = [
  // Query parsing (api/lib/query.ts)
  { id: 'Q01', what: 'Numbers parsed with Number() instead of a strict pattern', file: 'api/lib/query.ts',
    edits: [['if (!pattern.test(text)) {', 'if (!Number.isFinite(Number(text))) {']] },
  { id: 'Q02', what: 'Numbers parsed with parseFloat()', file: 'api/lib/query.ts',
    edits: [['if (!pattern.test(text)) {', 'if (Number.isNaN(parseFloat(text))) {'], ['const num = Number(text);', 'const num = parseFloat(text);']] },
  { id: 'Q03', what: 'Number pattern not anchored at the end', file: 'api/lib/query.ts',
    edits: [['const NUMERIC = /^-?\\d+(\\.\\d+)?$/;', 'const NUMERIC = /^-?\\d+(\\.\\d+)?/;']] },
  { id: 'Q04', what: 'A leading plus sign accepted', file: 'api/lib/query.ts',
    edits: [['const NUMERIC = /^-?\\d+(\\.\\d+)?$/;', 'const NUMERIC = /^[-+]?\\d+(\\.\\d+)?$/;']] },
  { id: 'Q05', what: 'The sign dropped with Math.abs (emicalculator.net defect EC-01)', file: 'api/lib/query.ts',
    edits: [['const num = Number(text);', 'const num = Math.abs(Number(text));']] },
  { id: 'Q06', what: 'Minimum made exclusive (off by one)', file: 'api/lib/query.ts',
    edits: [['num < spec.min)', 'num <= spec.min)']] },
  { id: 'Q07', what: 'Maximum made exclusive (off by one)', file: 'api/lib/query.ts',
    edits: [['num > spec.max))', 'num >= spec.max))']] },
  { id: 'Q08', what: 'Decimal-places limit not enforced (fractions of a paisa)', file: 'api/lib/query.ts',
    edits: [["spec.kind === 'number' && spec.decimals !== undefined &&", 'false &&']] },
  { id: 'Q09', what: 'Values not trimmed before validation', file: 'api/lib/query.ts',
    edits: [['const text = input.trim();', 'const text = input;']] },
  { id: 'Q10', what: 'Unknown-parameter check uses `in` (lets __proto__ and constructor through)', file: 'api/lib/query.ts',
    edits: [['if (!Object.hasOwn(schema, key)) {', 'if (!(key in schema)) {']] },
  { id: 'Q11', what: 'Unknown parameters silently ignored', file: 'api/lib/query.ts',
    edits: [['if (!Object.hasOwn(schema, key)) {', 'if (false) {']] },
  { id: 'Q12', what: 'A parameter given twice: the first value wins (HTTP parameter pollution)', file: 'api/lib/query.ts',
    edits: [["        details.push({ param, issue: 'duplicate_parameter', message: `\"${param}\" may only be given once`, received: input });\n        continue;", '        input = [input[0]];']] },
  { id: 'Q13', what: 'A list filter accepted when only some values are valid', file: 'api/lib/query.ts',
    edits: [['if (bad.length || !items.length) {', 'if (bad.length === items.length) {']] },
  { id: 'Q14', what: 'Dates checked by pattern only (2023-02-29 accepted)', file: 'api/lib/query.ts',
    edits: [["const valid = ISO_DATE.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`)) && new Date(`${text}T00:00:00Z`).toISOString().startsWith(text);", 'const valid = ISO_DATE.test(text);']] },
  { id: 'Q15', what: 'Sort strips every leading minus (--amount accepted)', file: 'api/lib/query.ts',
    edits: [["const field = text.startsWith('-') ? text.slice(1) : text;", "const field = text.replace(/^-+/, '');"]] },
  { id: 'Q16', what: 'Integer parameters accept decimals', file: 'api/lib/query.ts',
    edits: [['const INTEGER = /^-?\\d+$/;', 'const INTEGER = /^-?\\d+(\\.\\d+)?$/;']] },

  // EMI route and maths
  { id: 'E01', what: 'Tenure not required to be a whole number of months', file: 'api/routes/emi.ts',
    edits: [['!Number.isInteger(months) || ', '']] },
  { id: 'E02', what: 'Tenure message prints raw floating point ("1.2000000000000002 months")', file: 'api/routes/emi.ts',
    edits: [['(got ${Math.round(months * 100) / 100} months)', '(got ${months} months)']] },
  { id: 'E03', what: '480-month limit made exclusive', file: 'api/routes/emi.ts',
    edits: [['months > TENURE_LIMIT_MONTHS', 'months >= TENURE_LIMIT_MONTHS']] },
  { id: 'E04', what: 'No special case for a 0% rate (0/0)', file: 'api/lib/emi.ts',
    edits: [['  if (annualRatePct === 0) return principal / months;\n', '']] },
  { id: 'E05', what: 'Monthly rate from a 360-day year', file: 'api/lib/emi.ts',
    edits: [['  const r = annualRatePct / 12 / 100;\n  const growth', '  const r = (annualRatePct / 100 / 360) * 30.4375;\n  const growth']] },
  { id: 'E06', what: 'Payments grouped into the wrong calendar year', file: 'api/lib/emi.ts',
    edits: [['startYear + Math.floor((startMonth - 1 + k) / 12)', 'startYear + Math.floor((startMonth + k) / 12)']] },
  { id: 'E07', what: 'Last instalment not adjusted to clear the balance', file: 'api/lib/emi.ts',
    edits: [['k === months - 1 ? balance : emi - interest', 'emi - interest']] },
  { id: 'E08', what: 'Totals rounded to whole rupees instead of paise', file: 'api/lib/emi.ts',
    edits: [['    totalInterest: round2(totalPayment - principal),\n    totalPayment: round2(totalPayment),', '    totalInterest: Math.round(totalPayment - principal),\n    totalPayment: Math.round(totalPayment),']] },
  // E09-E11 agree with their own echo of the inputs, so only an oracle built from the request catches them.
  { id: 'E09', what: 'Tenure units swapped (years read as months)', file: 'api/routes/emi.ts',
    edits: [["const months = params.tenureUnit === 'years' ? tenure * 12 : tenure;", "const months = params.tenureUnit === 'months' ? tenure * 12 : tenure;"]] },
  { id: 'E10', what: 'Default start month off by one (getMonth() is zero-based)', file: 'api/routes/emi.ts',
    edits: [[': [now.getFullYear(), now.getMonth() + 1];', ': [now.getFullYear(), now.getMonth()];']] },
  { id: 'E11', what: 'Start month echoed without zero padding ("2026-1")', file: 'api/routes/emi.ts',
    edits: [["startMonth: `${startYear}-${String(startMonth).padStart(2, '0')}`", 'startMonth: `${startYear}-${startMonth}`']] },

  // Loan list, summary and single loan (api/routes/loans.ts)
  { id: 'L01', what: 'Search made case-sensitive', file: 'api/routes/loans.ts',
    edits: [['const q = (params.q as string | undefined)?.toLowerCase();', 'const q = params.q as string | undefined;']] },
  { id: 'L02', what: 'Search text treated as a regular expression', file: 'api/routes/loans.ts',
    edits: [['!loan.borrower.toLowerCase().includes(q)', '!new RegExp(q).test(loan.borrower.toLowerCase())']] },
  { id: 'L03', what: 'Minimum amount made exclusive', file: 'api/routes/loans.ts',
    edits: [['loan.amount < (params.minAmount as number)', 'loan.amount <= (params.minAmount as number)']] },
  { id: 'L04', what: 'Inverted rate band not rejected', file: 'api/routes/loans.ts',
    edits: [["  assertOrdered(params, 'minRate', 'maxRate');\n", '']] },
  { id: 'L05', what: 'Monthly EMI inflow counts closed and pending loans too', file: 'api/routes/loans.ts',
    edits: [[".filter((l) => l.status === 'active' || l.status === 'overdue')", '.filter(() => true)']] },
  { id: 'L06', what: 'Weighted rate divides by zero when nothing matches', file: 'api/routes/loans.ts',
    edits: [['weightedAverageRate: totalPrincipal ? round2(sum(loans.map((l) => l.amount * l.rate)) / totalPrincipal) : 0,', 'weightedAverageRate: round2(sum(loans.map((l) => l.amount * l.rate)) / totalPrincipal),']] },
  { id: 'L07', what: 'Summary accepts the list’s paging and sorting', file: 'api/routes/loans.ts',
    edits: [['const params = parseQuery(req, filterSchema);', 'const params = parseQuery(req, listSchema);']] },
  { id: 'L08', what: 'Loan ID pattern made case-insensitive', file: 'api/routes/loans.ts',
    edits: [['const LOAN_ID = /^LN-\\d{4}$/;', 'const LOAN_ID = /^LN-\\d{4}$/i;']] },
  { id: 'L09', what: 'Loan ID pattern not anchored at the end', file: 'api/routes/loans.ts',
    edits: [['const LOAN_ID = /^LN-\\d{4}$/;', 'const LOAN_ID = /^LN-\\d{4}/;']] },
  { id: 'L11', what: 'Monthly EMI inflow rounded to whole rupees', file: 'api/routes/loans.ts',
    edits: [['monthlyEmiInflow: round2(sum(', 'monthlyEmiInflow: Math.round(sum(']] },
  { id: 'L12', what: 'Minimum rate made exclusive', file: 'api/routes/loans.ts',
    edits: [['loan.rate < (params.minRate as number)', 'loan.rate <= (params.minRate as number)']] },
  { id: 'L13', what: 'End date made exclusive', file: 'api/routes/loans.ts',
    edits: [['loan.disbursedOn > (params.disbursedTo as string)', 'loan.disbursedOn >= (params.disbursedTo as string)']] },
  { id: 'L14', what: 'Each loan\'s EMI truncated to the paisa instead of rounded', file: 'api/routes/loans.ts',
    edits: [['emi: Math.round(monthlyEmi(loan.amount, loan.rate, loan.tenureMonths) * 100) / 100', 'emi: Math.floor(monthlyEmi(loan.amount, loan.rate, loan.tenureMonths) * 100) / 100']] },
  { id: 'L10', what: 'An empty result reports 0 pages', file: 'api/routes/loans.ts',
    edits: [['const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));', 'const totalPages = Math.ceil(sorted.length / pageSize);']] },

  // Server hardening (api/app.ts, api/lib/errors.ts)
  { id: 'S01', what: 'Broken percent-encoding reaches the generic 500 handler', file: 'api/lib/errors.ts',
    edits: [['  if (err instanceof URIError) {', '  if (false) {']] },
  { id: 'S02', what: 'X-Content-Type-Options: nosniff removed', file: 'api/app.ts',
    edits: [["      'X-Content-Type-Options': 'nosniff',\n", '']] },
  { id: 'S03', what: 'Write methods reach the router', file: 'api/app.ts',
    edits: [['  app.use(getOnly);\n', '']] },
  { id: 'S04', what: 'CORS opened to every origin', file: 'api/app.ts',
    edits: [["      'Referrer-Policy': 'no-referrer',\n", "      'Referrer-Policy': 'no-referrer',\n      'Access-Control-Allow-Origin': '*',\n"]] },
  { id: 'S06', what: 'X-Powered-By: Express announced again (server fingerprint)', file: 'api/app.ts',
    edits: [["  app.disable('x-powered-by');\n", '']] },
  { id: 'S08', what: 'API responses cacheable (no-store removed)', file: 'api/app.ts',
    edits: [["res.set('Cache-Control', 'no-store');", '']] },
  { id: 'S09', what: 'No cap on the number of query parameters', file: 'api/app.ts',
    edits: [['  api.use(limitQueryParameters);\n', '']] },
  { id: 'S11', what: 'A city left out of the filter vocabulary', file: 'api/app.ts',
    edits: [['cities: CITIES }', 'cities: CITIES.slice(1) }']] },
];

const SUITE = 'loanlens-api';
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
  API_PORT: PORT,
  API_BASE_URL: `http://localhost:${PORT}/api`,
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
      const run = runSuite(SUITE);
      if (!run.error && run.total !== baseline) run.error = `${run.total} scenarios ran; the baseline had ${baseline}`;
      const status = run.error ? 'ERROR' : run.failed.length ? 'killed' : m.equivalent ? 'equivalent' : 'SURVIVED';
      results.push({ ...m, ...run, status });
      console.log(`${m.id} ${status.padEnd(10)} ${m.what} (${run.error ?? `${run.failed.length} failed`}, ${run.seconds}s)`);
    } finally {
      writeFileSync(target, original);
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
  '# Mutation check, Section B',
  '',
  `Run ${new Date().toISOString()} · node ${process.version} · \`${command}\``,
  '',
  `Each mutant is a small, realistic bug, written by hand and planted in a temporary copy of the LoanLens API. The suite that owns that code (${SUITE}, B2) is run against the copy. A mutant counts as killed only if the run completed with the baseline's scenario count and at least one step or After-hook assertion failed. **${t.killed} of ${results.length} killed**, ${t.equivalent} equivalent, **${t.survived} survived**, ${t.errored} did not run cleanly.`,
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
