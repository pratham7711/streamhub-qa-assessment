import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../../framework/support/world.js';
import { LoanLensApiClient } from '../api/LoanLensApiClient.js';
import { describe, last } from '../../framework/steps/common-api.steps.js';
import { validateSchema } from '../api/schemas.js';
import type { ApiResponse } from '../../framework/api/BaseApiClient.js';
import { calendarYearSchedule, expectedEmi } from '../../framework/oracles/emi.js';
import { emiOf, expectedPage, expectedSummary, loanBook } from '../../framework/oracles/loan-book.js';

const toPaise = (rupees: number) => Math.round(rupees * 100) / 100;

const client = (world: CustomWorld) => new LoanLensApiClient(world.request);

Then('the response should match the {string} schema', function (this: CustomWorld, schema: string) {
  const res = last(this);
  expect(res.json, `Body is not JSON:\n${describe(res)}`).toBeDefined();
  const problems = validateSchema(schema, res.json);
  expect(problems, `Body does not match the "${schema}" schema:\n${problems.join('\n')}\n\n${describe(res)}`).toEqual([]);
});

/**
 * Schedule money agrees to within ₹1, or 2 parts in 10^7 of the loan principal
 * for very large loans (rounding error scales with the loan, not with the row).
 * Two correct float64 amortisations drift apart as (1+r)^n grows: at ₹10 crore,
 * 50%, 480 months from 2026-01, an exact Decimal computation puts the 2064
 * closing balance at ₹3,87,29,024.39; the app is ₹7.07 above it and this
 * oracle ₹3.31 below, a gap of ₹10.38 (1.04 parts in 10^7). See
 * docs/ai-pairing-log.md, #5.
 */
function expectRupees(actual: number, expected: number, label: string, loanPrincipal = expected) {
  const tolerance = Math.max(1, Math.abs(loanPrincipal) * 2e-7);
  expect(Math.abs(actual - expected), `${label}: got ${actual}, expected ${expected.toFixed(2)} (±₹${tolerance.toFixed(2)})`).toBeLessThanOrEqual(tolerance);
}

/**
 * EMI and the two totals come from the closed-form formula, so nothing
 * compounds: they must agree to the paisa. Measured across 5,005 loans
 * (including the ₹10 crore, 50%, 480-month corner) the worst gap is ₹0.005,
 * which is rounding to paise.
 */
function expectPaise(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: got ${actual}, expected ${expected.toFixed(3)} (±₹0.01)`).toBeLessThanOrEqual(0.01);
}
const queryOf = (url: string) => new URL(url).search.replace(/^\?/, '');

interface Loan { id: string; type: string; status: string; amount: number; rate: number; emi: number }
interface ListBody { data: Loan[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }

Given('the LoanLens API is up', async function (this: CustomWorld) {
  const res = await client(this).health();
  expect(res.status, describe(res)).toBe(200);
});

When('I send a {word} request to {string}', async function (this: CustomWorld, method: string, pathAndQuery: string) {
  const api = client(this);
  this.lastResponse = method === 'GET' ? await api.raw(pathAndQuery) : await api.send(method as 'POST', pathAndQuery);
  this.attach(describe(this.lastResponse), 'text/plain');
});

When('I send a GET request to {string} with {string} repeated {int} times', async function (this: CustomWorld, path: string, pair: string, count: number) {
  this.lastResponse = await client(this).raw(`${path}?${Array(count).fill(pair).join('&')}`);
  this.attach(describe(this.lastResponse), 'text/plain');
});

When('I send a GET request to {string} from a page on {string}', async function (this: CustomWorld, pathAndQuery: string, origin: string) {
  this.lastResponse = await client(this).raw(pathAndQuery, { Origin: origin });
  this.attach(describe(this.lastResponse), 'text/plain');
});

Then('the response should contain exactly the loans the loan book has for that query', function (this: CustomWorld) {
  const res = last(this);
  const body = res.json as ListBody;
  const expected = expectedPage(queryOf(res.url));
  expect(body.meta.total, 'meta.total').toBe(expected.total);
  expect(body.meta.totalPages, 'meta.totalPages').toBe(expected.totalPages);
  expect(body.data.map((l) => l.id), 'ids on this page, in order').toEqual(expected.ids);
  this.attach(`Oracle: ${expected.total} matching loans; page ids ${expected.ids.join(', ') || '(none)'}`, 'text/plain');
});

Then('the returned loans should be sorted by {word} {word}', function (this: CustomWorld, field: string, direction: string) {
  const values = (last(this).json as ListBody).data.map((l) => (l as unknown as Record<string, number | string>)[field]);
  const sorted = [...values].sort((a, b) => (typeof a === 'number' ? (a as number) - (b as number) : String(a).localeCompare(String(b))));
  expect(values).toEqual(direction === 'descending' ? sorted.reverse() : sorted);
});

Then('the page should hold {int} loan(s)', function (this: CustomWorld, count: number) {
  expect((last(this).json as ListBody).data).toHaveLength(count);
});

Then('every loan should carry the EMI computed from its own amount, rate and tenure', function (this: CustomWorld) {
  const book = new Map(loanBook().map((l) => [l.id, l]));
  for (const loan of (last(this).json as ListBody).data) {
    const source = book.get(loan.id);
    expect(source, `${loan.id} exists in the loan book`).toBeDefined();
    expect(loan.emi, `${loan.id} emi`).toBeCloseTo(toPaise(emiOf(source!)), 2);
  }
});

Then('the loan should equal record {string} of the loan book', function (this: CustomWorld, id: string) {
  const record = loanBook().find((l) => l.id === id);
  expect(record, `${id} in loan book`).toBeDefined();
  const { data } = last(this).json as { data: Loan };
  expect(data).toMatchObject({ ...record });
  expect(data.emi, `${id} emi`).toBeCloseTo(toPaise(emiOf(record!)), 2);
});

Then('the vocabulary should list exactly the loan types, statuses and cities of the loan book', function (this: CustomWorld) {
  const { data } = last(this).json as { data: { loanTypes: string[]; statuses: string[]; cities: string[] } };
  const distinct = (pick: (l: ReturnType<typeof loanBook>[number]) => string) => [...new Set(loanBook().map(pick))].sort();
  expect([...data.loanTypes].sort(), 'loan types').toEqual(distinct((l) => l.type));
  expect([...data.statuses].sort(), 'statuses').toEqual(distinct((l) => l.status));
  expect([...data.cities].sort(), 'cities').toEqual(distinct((l) => l.city));
});

Then('the summary should match the loan book for that query', function (this: CustomWorld) {
  const res = last(this);
  const { data } = res.json as {
    data: {
      count: number; totalPrincipal: number; weightedAverageRate: number; monthlyEmiInflow: number;
      byType: { type: string; count: number; principal: number }[];
      byStatus: { status: string; count: number; principal: number }[];
    };
  };
  const expected = expectedSummary(queryOf(res.url));
  expect(data.count, 'count').toBe(expected.count);
  expect(data.totalPrincipal, 'totalPrincipal').toBe(expected.totalPrincipal);
  expect(data.weightedAverageRate, 'weightedAverageRate').toBeCloseTo(expected.weightedAverageRate, 2);
  expectPaise(data.monthlyEmiInflow, expected.monthlyEmiInflow, 'monthlyEmiInflow');
  for (const row of data.byType) expect(row, `byType.${row.type}`).toMatchObject(expected.byType[row.type]);
  for (const row of data.byStatus) expect(row, `byStatus.${row.status}`).toMatchObject(expected.byStatus[row.status]);
  this.attachJson('Oracle summary', expected);
});

Then('the {word} breakdown should add up to the totals', function (this: CustomWorld, key: string) {
  const { data } = last(this).json as { data: Record<string, unknown> & { count: number; totalPrincipal: number } };
  const rows = data[key === 'type' ? 'byType' : 'byStatus'] as { count: number; principal: number }[];
  expect(rows.reduce((s, r) => s + r.count, 0), `sum of ${key} counts`).toBe(data.count);
  expect(rows.reduce((s, r) => s + r.principal, 0), `sum of ${key} principal`).toBe(data.totalPrincipal);
});

interface EmiBody {
  data: {
    emi: number; totalInterest: number; totalPayment: number;
    inputs: { principal: number; rate: number; tenureMonths: number; startMonth: string };
    schedule: { year: number; payments: number; principal: number; interest: number; totalPayment: number; closingBalance: number }[];
  };
}

/** The loan as the caller asked for it. Expected figures come from the request, never from the app's echo of it. */
function requestedLoan(res: ApiResponse) {
  const params = new URL(res.url).searchParams;
  const tenure = Number(params.get('tenure'));
  const now = new Date();
  const startMonth = params.get('startMonth') ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    principal: Number(params.get('principal')),
    rate: Number(params.get('rate')),
    tenureMonths: params.get('tenureUnit') === 'months' ? tenure : tenure * 12,
    startMonth,
  };
}

function checkEmiFigures(res: ApiResponse) {
  const asked = requestedLoan(res);
  const mine = expectedEmi({ principal: asked.principal, annualRatePct: asked.rate, months: asked.tenureMonths });
  const { data } = res.json as EmiBody;
  expect(data.inputs, 'the loan the app calculated is the loan that was asked for').toEqual(asked);
  expectPaise(data.emi, mine.emi, 'emi');
  expectPaise(data.totalPayment, mine.totalPayment, 'totalPayment');
  expectPaise(data.totalInterest, mine.totalInterest, 'totalInterest');
  return mine;
}

function checkSchedule(res: ApiResponse) {
  const asked = requestedLoan(res);
  const { data } = res.json as EmiBody;
  const [year, month] = asked.startMonth.split('-').map(Number);
  const mine = calendarYearSchedule({ principal: asked.principal, annualRatePct: asked.rate, months: asked.tenureMonths }, year, month);
  expect(data.schedule.map((r) => r.year), 'calendar years').toEqual(mine.map((r) => r.year));
  data.schedule.forEach((row, i) => {
    expect(row.payments, `${row.year} payments`).toBe(mine[i].payments);
    const scale = asked.principal;
    expectRupees(row.principal, mine[i].principal, `${row.year} principal`, scale);
    expectRupees(row.interest, mine[i].interest, `${row.year} interest`, scale);
    expectRupees(row.totalPayment, mine[i].total, `${row.year} total paid`, scale);
    expectRupees(row.closingBalance, mine[i].closingBalance, `${row.year} closing balance`, scale);
  });
  const paid = data.schedule.reduce((s, r) => s + r.principal, 0);
  expectRupees(paid, asked.principal, 'principal repaid over the schedule');
  expect(data.schedule.at(-1)?.closingBalance, 'final balance: the last instalment clears the loan exactly').toBe(0);
}

Then('the EMI figures should match my own calculation', function (this: CustomWorld) {
  this.attachJson('Independently computed', checkEmiFigures(last(this)));
});

Then('the yearly schedule should match my own amortisation', function (this: CustomWorld) {
  checkSchedule(last(this));
});

/** mulberry32: a tiny seeded generator, so any failing loan can be replayed from the seed. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * One valid loan from the whole input domain: ₹1,000 to ₹10 crore (log-uniform, with paise),
 * 0% to 50% (0% one time in twenty), 1 to 480 months, sometimes sent in years when the months
 * make a quarter year (exact in binary), and a first EMI anywhere from 2020 to 2035.
 */
function randomValidLoanQuery(next: () => number): string {
  const months = 1 + Math.floor(next() * 480);
  const inYears = months % 3 === 0 && next() < 0.5;
  const principal = Math.round(10 ** (3 + next() * 5) * 100) / 100;
  const rate = next() < 0.05 ? 0 : Math.round(next() * 5000) / 100;
  const start = `${2020 + Math.floor(next() * 16)}-${String(1 + Math.floor(next() * 12)).padStart(2, '0')}`;
  const tenure = inYears ? `${months / 12}&tenureUnit=years` : `${months}&tenureUnit=months`;
  return `/emi?principal=${principal}&rate=${rate}&tenure=${tenure}&startMonth=${start}`;
}

/**
 * The feature pins a seed so CI is repeatable. PBT_SEED=<n> (or PBT_SEED=random) draws a
 * different sample for exploration; the seed used is attached to the report either way.
 * There is no shrinking: a failure names the exact request to replay, not a minimal one.
 */
When('I request the EMI for {int} random valid loans drawn with seed {int}', async function (this: CustomWorld, count: number, pinned: number) {
  const override = process.env.PBT_SEED;
  const seed = !override ? pinned : override === 'random' ? Math.floor(Math.random() * 2 ** 32) : Number(override);
  if (!Number.isInteger(seed)) throw new Error(`PBT_SEED must be an integer or "random", got "${override}"`);
  const next = seededRandom(seed);
  const api = client(this);
  const answers: ApiResponse[] = [];
  for (let i = 0; i < count; i += 1) answers.push(await api.raw(randomValidLoanQuery(next)));
  this.scenario.randomAnswers = answers;
  this.attach(`${count} loans drawn with seed ${seed}${override ? ` (PBT_SEED; the feature pins ${pinned})` : ''}. First three:\n${answers.slice(0, 3).map((a) => a.url).join('\n')}`, 'text/plain');
});

Then('every answer should match my own EMI, totals and calendar-year schedule', function (this: CustomWorld) {
  const answers = this.scenario.randomAnswers as ApiResponse[];
  answers.forEach((res, i) => {
    try {
      expect(res.status, describe(res)).toBe(200);
      expect(validateSchema('emi', res.json), 'schema problems').toEqual([]);
      checkEmiFigures(res);
      checkSchedule(res);
    } catch (error) {
      throw new Error(`Loan ${i + 1} of ${answers.length} disagrees. Replay it with GET ${res.url}\n${(error as Error).message}`);
    }
  });
});

Then('the error details should name {int} problems', function (this: CustomWorld, count: number) {
  const res = last(this);
  const details = (res.json as { error?: { details?: unknown[] } }).error?.details ?? [];
  expect(details, describe(res)).toHaveLength(count);
});
