/**
 * Steps for the LoanLens web UI (section-a/loanlens-ui/features). Screens are driven
 * through the page objects in section-a/loanlens-ui/pages; every expected number comes
 * from the suite's own oracles (framework/oracles/emi.ts, framework/oracles/loan-book.ts).
 */
import { Given, Then, When, type DataTable } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { Locator } from 'playwright';
import { env } from '../../../framework/config/env.js';
import type { CustomWorld } from '../../../framework/support/world.js';
import { CalculatorPage, type CalculatorField, type LoanEntry, type TenureUnit } from '../pages/CalculatorPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { DonutChart, BarChart, type ChartMark } from '../pages/components.js';
import { LoanDetailPage } from '../pages/LoanDetailPage.js';
import { ReportsPage, type ReportFilter } from '../pages/ReportsPage.js';
import { calendarYearSchedule, expectedEmi, parseIndianAmount, readNumber, type CalendarYearRow, type LoanInput } from '../../../framework/oracles/emi.js';
import { readDisplayDate, readTenureMonths } from '../display.js';
import { emiOf, expectedPage, expectedSummary, loanBook, type BookLoan } from '../../../framework/oracles/loan-book.js';

const TYPES = ['home', 'personal', 'car', 'education'];
const STATUSES = ['active', 'closed', 'overdue', 'pending'];
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Screens show whole rupees, so a figure may sit up to ₹0.50 from the exact value,
 * plus ₹0.01 because the API rounds to the paisa first. The float drift the API suite
 * allows for at its ₹10 crore / 50% / 480-month corner stays below a paisa for every
 * loan these screens show (measured: the whole suite passes at this tolerance), and
 * anything looser would accept a figure truncated instead of rounded.
 */
const SCREEN_TOLERANCE = 0.51;

function expectRupees(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: shown ₹${actual}, expected ₹${expected.toFixed(2)} (±₹${SCREEN_TOLERANCE})`).toBeLessThanOrEqual(SCREEN_TOLERANCE);
}

/** Retries until the on-screen amount is within tolerance of `expected`. */
async function expectAmountOnScreen(locator: Locator, expected: number, label: string) {
  await expect(async () => {
    expectRupees(readNumber(await locator.innerText()), expected, label);
  }).toPass({ timeout: env.timeouts.defaultMs });
}

const currentQuery = (world: CustomWorld) => new URL(world.page.url()).search.replace(/^\?/, '');

// ---------------------------------------------------------------- loans under test

function loanInput(entry: LoanEntry): LoanInput {
  return { principal: entry.principal, annualRatePct: entry.ratePct, months: entry.unit === 'years' ? Math.round(entry.tenure * 12) : entry.tenure };
}

function ownSchedule(entry: LoanEntry): CalendarYearRow[] {
  const [year, month] = entry.startMonth.split('-').map(Number);
  return calendarYearSchedule(loanInput(entry), year, month);
}

function bookLoan(id: string): BookLoan {
  const loan = loanBook().find((l) => l.id === id);
  if (!loan) throw new Error(`${id} is not in the loan book`);
  return loan;
}

function bookLoanSchedule(loan: BookLoan): CalendarYearRow[] {
  const [year, month] = loan.disbursedOn.split('-').map(Number);
  return calendarYearSchedule({ principal: loan.amount, annualRatePct: loan.rate, months: loan.tenureMonths }, year, month);
}

function expectBarsMatchSchedule(bars: ChartMark[], schedule: CalendarYearRow[]) {
  expect(bars.map((b) => b.key), 'one bar per calendar year, in order').toEqual(schedule.map((r) => String(r.year)));
  bars.forEach((bar, i) => {
    const row = schedule[i];
    expectRupees(bar.segments.principal, row.principal, `${row.year} principal segment`);
    expectRupees(bar.segments.interest, row.interest, `${row.year} interest segment`);
    expectRupees(bar.value, row.total, `${row.year} bar total`);
    const named = bar.name.match(/^(\d{4}): Principal (₹[\d,]+), Interest (₹[\d,]+), total (₹[\d,]+)$/);
    expect(named, `${row.year} bar accessible name "${bar.name}"`).not.toBeNull();
    expectRupees(readNumber(named![2]), row.principal, `${row.year} principal in the bar's name`);
    expectRupees(readNumber(named![3]), row.interest, `${row.year} interest in the bar's name`);
    expectRupees(readNumber(named![4]), row.total, `${row.year} total in the bar's name`);
  });
  expectDrawnToScale(bars);
}

/**
 * The data-value attributes can be right while the drawing is wrong, so the pixels are
 * checked too: every stacked segment's height must be its value times one common scale.
 */
function expectDrawnToScale(bars: ChartMark[]) {
  const segments = bars.flatMap((bar) => Object.keys(bar.segments).map((key) => ({ label: `${bar.key} ${key}`, value: bar.segments[key], height: bar.segmentHeights[key] })));
  const pxPerRupee = segments.reduce((sum, s) => sum + s.height, 0) / segments.reduce((sum, s) => sum + s.value, 0);
  for (const s of segments) {
    expect(Math.abs(s.height - s.value * pxPerRupee), `${s.label} segment drawn ${s.height.toFixed(1)}px for a value of ${Math.round(s.value)} (scale ${pxPerRupee.toExponential(3)} px per unit)`).toBeLessThanOrEqual(1);
  }
}

// ---------------------------------------------------------------- navigation (all screens)

Given('I open the LoanLens dashboard', async function (this: CustomWorld) {
  await new DashboardPage(this.page).open();
});

Given('I open the LoanLens EMI calculator', async function (this: CustomWorld) {
  await new CalculatorPage(this.page).open();
});

Given('I open the LoanLens loan book report', async function (this: CustomWorld) {
  await new ReportsPage(this.page).open();
});

Given('I open the LoanLens loan book report at {string}', async function (this: CustomWorld, query: string) {
  await new ReportsPage(this.page).open(query);
});

Given('I open the LoanLens loan detail page for {string}', async function (this: CustomWorld, id: string) {
  await new LoanDetailPage(this.page, id).open();
});

When('I follow the {string} link in the main navigation', async function (this: CustomWorld, name: string) {
  await new DashboardPage(this.page).navLink(name).click();
});

When('I follow the {string} link in the breadcrumb', async function (this: CustomWorld, name: string) {
  await new LoanDetailPage(this.page, '').breadcrumb.getByRole('link', { name, exact: true }).click();
});

When('I follow the {string} link', async function (this: CustomWorld, name: string) {
  await this.page.getByRole('link', { name, exact: true }).click();
});

When('I reload the page', async function (this: CustomWorld) {
  await this.page.reload();
});

When('I go back in the browser history', async function (this: CustomWorld) {
  await this.page.goBack();
});

When('I go forward in the browser history', async function (this: CustomWorld) {
  await this.page.goForward();
});

When('I press Tab', async function (this: CustomWorld) {
  await this.page.keyboard.press('Tab');
});

Then('the address bar should show {string}', async function (this: CustomWorld, expected: string) {
  await expect
    .poll(() => {
      const url = new URL(this.page.url());
      return decodeURIComponent(url.pathname + url.search);
    }, { message: 'path and query in the address bar' })
    .toBe(expected);
});

Then('the LoanLens screen heading should be {string}', async function (this: CustomWorld, heading: string) {
  await expect(this.page.getByRole('heading', { level: 1 })).toHaveText(heading);
});

Then('the browser tab title should be {string}', async function (this: CustomWorld, title: string) {
  await expect(this.page).toHaveTitle(title);
});

Then('the {string} link in the main navigation should be marked as the current page', async function (this: CustomWorld, name: string) {
  const nav = new DashboardPage(this.page);
  await expect(nav.navLink(name)).toHaveAttribute('aria-current', 'page');
  const current = await nav.primaryNav.getByRole('link').evaluateAll((links) => links.filter((l) => l.getAttribute('aria-current') === 'page').length);
  expect(current, 'exactly one navigation link is current').toBe(1);
});

Then('the page should say {string}', async function (this: CustomWorld, text: string) {
  await expect(this.page.getByText(text, { exact: true })).toBeVisible();
});

Then('I capture evidence {string}', async function (this: CustomWorld, label: string) {
  await this.captureEvidence(label);
});

// ---------------------------------------------------------------- dashboard

Then('the dashboard key figures should match the loan book', async function (this: CustomWorld) {
  const { keyFigures } = new DashboardPage(this.page);
  const book = expectedSummary('');
  this.attachJson('Loan book summary (oracle)', book);
  await expect(keyFigures.value('Total loans')).toHaveText(String(book.count));
  await expect(keyFigures.figure('Total loans')).toContainText(`${book.byStatus.active.count} active`);
  expect(await keyFigures.number('Principal disbursed'), 'Principal disbursed').toBe(book.totalPrincipal);
  await expect(keyFigures.value('Weighted avg. rate')).toHaveText(`${book.weightedAverageRate.toFixed(2)}%`);
  expectRupees(await keyFigures.number('Monthly EMI inflow'), book.monthlyEmiInflow, 'Monthly EMI inflow');
});

Then(
  'the {string} donut should draw one non-empty slice per loan type with the loan book\'s principal',
  async function (this: CustomWorld, title: string) {
    const slices = await new DonutChart(this.page, title).readSlices();
    const book = expectedSummary('');
    expect(slices.map((s) => s.key), 'one slice per loan type').toEqual(TYPES);
    for (const slice of slices) {
      expect(slice.value, `${slice.key} principal`).toBe(book.byType[slice.key].principal);
      expect(slice.value, `${slice.key} principal should be positive`).toBeGreaterThan(0);
      expect(slice.drawn, `${slice.key} slice should be drawn`).toBeGreaterThan(0);
    }
  },
);

Then('the slices of the {string} donut should add up to the total in its legend', async function (this: CustomWorld, title: string) {
  const donut = new DonutChart(this.page, title);
  const slices = await donut.readSlices();
  const rows = await donut.legendRows();
  const footer = await donut.legendTotal();
  const valueColumn = Object.keys(footer ?? {}).find((k) => k !== 'Segment' && k !== 'Share');
  expect(valueColumn, 'legend has a value column').toBeDefined();
  const sliceSum = slices.reduce((sum, s) => sum + s.value, 0);
  expectRupees(readNumber(footer![valueColumn!]), sliceSum, 'legend total vs sum of slices');
  for (const slice of slices) {
    const row = rows.find((r) => slice.name.startsWith(`${r.Segment}:`));
    expect(row, `legend row for slice "${slice.name}"`).toBeDefined();
    expectRupees(readNumber(row![valueColumn!]), slice.value, `legend value for ${row!.Segment}`);
  }
  expect(footer!.Share).toBe('100.0%');
});

Then('the legend shares of the {string} donut should add up to 100%', async function (this: CustomWorld, title: string) {
  const rows = await new DonutChart(this.page, title).legendRows();
  const total = rows.reduce((sum, r) => sum + readNumber(r.Share), 0);
  expect(Math.abs(total - 100), `shares ${rows.map((r) => r.Share).join(' + ')} = ${total.toFixed(1)}%`).toBeLessThanOrEqual(0.05 * rows.length);
});

Then('the {string} chart should show the loan book\'s count for every status', async function (this: CustomWorld, title: string) {
  const bars = await new BarChart(this.page, title).readBars();
  const book = expectedSummary('');
  expect(bars.map((b) => b.key)).toEqual(STATUSES);
  for (const bar of bars) {
    expect(bar.value, `${bar.key} loans`).toBe(book.byStatus[bar.key].count);
    expect(bar.drawn, `${bar.key} bar should be drawn`).toBeGreaterThan(0);
    expect(bar.name).toBe(`${capitalise(bar.key)}: ${bar.value} loans`);
  }
  expectDrawnToScale(bars);
});

Then('the bars of the {string} chart should add up to {int} loans', async function (this: CustomWorld, title: string, total: number) {
  const bars = await new BarChart(this.page, title).readBars();
  expect(bars.reduce((sum, b) => sum + b.value, 0)).toBe(total);
});

Then('the recent disbursements table should list the {int} most recently disbursed loans', async function (this: CustomWorld, count: number) {
  const dashboard = new DashboardPage(this.page);
  const expected = expectedPage(`sort=-disbursedOn&pageSize=${count}`).ids;
  const rows = await dashboard.recentRows();
  expect(rows.map((r) => r.Loan), 'loan IDs, newest first').toEqual(expected);
  for (const row of rows) {
    const loan = bookLoan(row.Loan);
    expect(row.Borrower).toBe(loan.borrower);
    expect(row.Type).toBe(capitalise(loan.type));
    expect(row.City).toBe(loan.city);
    expect(readNumber(row.Amount), `${loan.id} amount`).toBe(loan.amount);
    expect(readDisplayDate(row.Disbursed), `${loan.id} disbursed "${row.Disbursed}"`).toBe(loan.disbursedOn);
    expect(row.Status).toBe(capitalise(loan.status));
  }
});

When('I open the most recently disbursed loan from the dashboard', async function (this: CustomWorld) {
  const [id] = expectedPage('sort=-disbursedOn&pageSize=1').ids;
  this.remember('loanId', id);
  await new DashboardPage(this.page).recentLoanLink(id).click();
});

Then('I should be on the detail page of that loan', async function (this: CustomWorld) {
  const id = this.recall<string>('loanId');
  const detail = new LoanDetailPage(this.page, id);
  await expect(this.page).toHaveURL(new RegExp(`/loans/${id}$`));
  await expect(detail.heading).toHaveText(`${id} · ${bookLoan(id).borrower}`);
});

// ---------------------------------------------------------------- EMI calculator

When(
  'I enter a loan of {string} at {float}% for {int} {word} with the first EMI in {string}',
  async function (this: CustomWorld, amount: string, ratePct: number, tenure: number, unit: string, startMonth: string) {
    if (unit !== 'years' && unit !== 'months') throw new Error(`Tenure unit must be "years" or "months", got "${unit}"`);
    const entry: LoanEntry = { principal: parseIndianAmount(amount), ratePct, tenure, unit, startMonth };
    await new CalculatorPage(this.page).enterLoan(entry);
    this.remember('loan', entry);
  },
);

When(
  'I use the sliders\' keyboard controls to set a loan of {string} at {float}% for {int} years',
  async function (this: CustomWorld, amount: string, ratePct: number, years: number) {
    const calc = new CalculatorPage(this.page);
    await calc.unitOption('years').check();
    await calc.slideTo('Loan amount', parseIndianAmount(amount));
    await calc.slideTo('Interest rate', ratePct);
    await calc.slideTo('Loan tenure', years);
    await calc.waitForResults();
    this.remember<LoanEntry>('loan', { principal: parseIndianAmount(amount), ratePct, tenure: years, unit: 'years', startMonth: await calc.startMonth.inputValue() });
  },
);

Then('the number boxes should show {int}, {float} and {int}', async function (this: CustomWorld, amount: number, ratePct: number, tenure: number) {
  const calc = new CalculatorPage(this.page);
  await expect(calc.box('Loan amount')).toHaveValue(String(amount));
  await expect(calc.box('Interest rate')).toHaveValue(String(ratePct));
  await expect(calc.box('Loan tenure')).toHaveValue(String(tenure));
});

When('I switch the tenure unit to {string}', async function (this: CustomWorld, unit: TenureUnit) {
  const calc = new CalculatorPage(this.page);
  await calc.unitOption(unit).check();
  await calc.waitForResults();
  const entry = this.recall<LoanEntry>('loan');
  this.remember<LoanEntry>('loan', { ...entry, unit, tenure: Number(await calc.box('Loan tenure').inputValue()) });
});

Then('the {string} box should contain {string}', async function (this: CustomWorld, field: CalculatorField, value: string) {
  await expect(new CalculatorPage(this.page).box(field)).toHaveValue(value);
});

When('I type {string} into the {string} box', async function (this: CustomWorld, value: string, field: CalculatorField) {
  await new CalculatorPage(this.page).box(field).fill(value);
  const entry = this.recall<LoanEntry>('loan');
  const n = Number(value);
  if (value.trim() !== '' && Number.isFinite(n)) {
    const key = ({ 'Loan amount': 'principal', 'Interest rate': 'ratePct', 'Loan tenure': 'tenure' } as const)[field];
    this.remember<LoanEntry>('loan', { ...entry, [key]: n });
  }
});

Then('the monthly EMI, total interest and total payment should match my own calculation', async function (this: CustomWorld) {
  const calc = new CalculatorPage(this.page);
  const entry = this.recall<LoanEntry>('loan');
  const mine = expectedEmi(loanInput(entry));
  this.attachJson('Independently computed', { input: loanInput(entry), ...mine });
  await calc.waitForResults();
  await expectAmountOnScreen(calc.result('Monthly EMI'), mine.emi, 'Monthly EMI');
  await expectAmountOnScreen(calc.result('Total interest'), mine.totalInterest, 'Total interest');
  await expectAmountOnScreen(calc.result('Total payment'), mine.totalPayment, 'Total payment');
});

Then('the monthly EMI should be {string} and the total interest {string}', async function (this: CustomWorld, emi: string, interest: string) {
  const calc = new CalculatorPage(this.page);
  await expect(calc.result('Monthly EMI')).toHaveText(emi);
  await expect(calc.result('Total interest')).toHaveText(interest);
});

Then('the payment break-up donut should split the total payment into principal and total interest', async function (this: CustomWorld) {
  const calc = new CalculatorPage(this.page);
  const entry = this.recall<LoanEntry>('loan');
  const mine = expectedEmi(loanInput(entry));
  const slices = await calc.breakUp.readSlices();
  expect(slices.map((s) => s.key), 'two slices: principal and interest').toEqual(['principal', 'interest']);
  const [principal, interest] = slices;
  expect(principal.value, 'principal slice').toBe(entry.principal);
  expectRupees(interest.value, mine.totalInterest, 'interest slice');
  for (const s of slices) expect(s.drawn, `${s.key} slice should be drawn`).toBeGreaterThan(0);
  expectRupees(principal.value + interest.value, readNumber(await calc.result('Total payment').innerText()), 'slices vs Total payment figure');
  const share = (s: ChartMark) => Number(/\((\d+(?:\.\d+)?)%\)$/.exec(s.name)?.[1]);
  expect(Math.abs(share(principal) - mine.principalShare * 100), 'principal share in slice name').toBeLessThanOrEqual(0.05);
  expect(Math.abs(share(interest) - mine.interestShare * 100), 'interest share in slice name').toBeLessThanOrEqual(0.05);
});

Then('the payment break-up donut should draw the principal as its only slice', async function (this: CustomWorld) {
  const calc = new CalculatorPage(this.page);
  const entry = this.recall<LoanEntry>('loan');
  const slices = await calc.breakUp.readSlices();
  expect(slices.map((s) => s.key)).toEqual(['principal']);
  expect(slices[0].value).toBe(entry.principal);
  expect(slices[0].name).toMatch(/\(100\.0%\)$/);
  const rows = await calc.breakUp.legendRows();
  expect(rows.find((r) => r.Segment === 'Total interest'), 'interest stays in the legend at zero').toMatchObject({ Amount: '₹0', Share: '0.0%' });
});

Then('the yearly payments chart should have one bar per calendar year of my own schedule', async function (this: CustomWorld) {
  const schedule = ownSchedule(this.recall<LoanEntry>('loan'));
  const bars = await new CalculatorPage(this.page).yearlyPayments.readBars();
  expect(bars.map((b) => b.key)).toEqual(schedule.map((r) => String(r.year)));
  this.attach(`Calendar years: ${schedule.map((r) => r.year).join(', ')} (${schedule.length} bars)`, 'text/plain');
});

Then('every yearly bar should match my own calendar-year amortisation', async function (this: CustomWorld) {
  const entry = this.recall<LoanEntry>('loan');
  const bars = await new CalculatorPage(this.page).yearlyPayments.readBars();
  expectBarsMatchSchedule(bars, ownSchedule(entry));
  expectRupees(bars.reduce((sum, b) => sum + b.value, 0), expectedEmi(loanInput(entry)).totalPayment, 'sum of bars vs total payment');
});

Then('the yearly amortisation table should match my own calendar-year amortisation', async function (this: CustomWorld) {
  const calc = new CalculatorPage(this.page);
  const entry = this.recall<LoanEntry>('loan');
  const schedule = ownSchedule(entry);
  const rows = await calc.scheduleRows();
  expect(rows.map((r) => r.Year)).toEqual(schedule.map((r) => String(r.year)));
  rows.forEach((row, i) => {
    const mine = schedule[i];
    expect(Number(row.Payments), `${mine.year} payments`).toBe(mine.payments);
    expectRupees(readNumber(row.Principal), mine.principal, `${mine.year} principal`);
    expectRupees(readNumber(row.Interest), mine.interest, `${mine.year} interest`);
    expectRupees(readNumber(row['Total paid']), mine.total, `${mine.year} total paid`);
    expectRupees(readNumber(row['Closing balance']), mine.closingBalance, `${mine.year} closing balance`);
  });
  const totals = await calc.scheduleTotals();
  const mine = expectedEmi(loanInput(entry));
  expect(Number(totals?.Payments), 'total payments').toBe(loanInput(entry).months);
  expect(readNumber(totals!.Principal), 'total principal').toBe(entry.principal);
  expectRupees(readNumber(totals!.Interest), mine.totalInterest, 'total interest');
  expect(readNumber(totals!['Closing balance']), 'final balance').toBe(0);
});

When('I hover over the {string} bar of the yearly payments chart', async function (this: CustomWorld, year: string) {
  await new CalculatorPage(this.page).yearlyPayments.bar(year).hover();
});

When('I move the pointer away from the chart', async function (this: CustomWorld) {
  await this.page.mouse.move(0, 0);
});

When('I move keyboard focus to the {string} bar of the yearly payments chart', async function (this: CustomWorld, year: string) {
  this.remember('focusedYear', year);
  await new CalculatorPage(this.page).yearlyPayments.bar(year).focus();
});

Then('the chart tooltip should show the {int} principal, interest and total from my own schedule', async function (this: CustomWorld, year: number) {
  const entry = this.recall<LoanEntry>('loan');
  const row = ownSchedule(entry).find((r) => r.year === year);
  expect(row, `${year} is in my schedule`).toBeDefined();
  const chart = new CalculatorPage(this.page).yearlyPayments;
  await expect(chart.tooltip).toContainText(String(year));
  const tip = await chart.readTooltip();
  this.attachJson(`Tooltip for ${year}`, tip);
  expect(tip.title).toBe(String(year));
  expectRupees(readNumber(tip.values.Principal), row!.principal, `${year} tooltip principal`);
  expectRupees(readNumber(tip.values.Interest), row!.interest, `${year} tooltip interest`);
  expectRupees(readNumber(tip.values.Total), row!.total, `${year} tooltip total`);
  expect(Number(tip.values.Payments), `${year} tooltip payments`).toBe(row!.payments);
  expectRupees(readNumber(tip.values.Balance), row!.closingBalance, `${year} tooltip balance`);
});

Then('no chart tooltip should be open', async function (this: CustomWorld) {
  await expect(new CalculatorPage(this.page).yearlyPayments.tooltip).toHaveCount(0);
});

Then('the focused bar should be described by the tooltip', async function (this: CustomWorld) {
  const bar = new CalculatorPage(this.page).yearlyPayments.bar(this.recall<string>('focusedYear'));
  await expect(bar).toBeFocused();
  await expect(bar).toHaveAccessibleDescription(/Principal.*Interest.*Total/s);
});

Then('the {string} box should show the error {string}', async function (this: CustomWorld, field: CalculatorField, message: string) {
  await new CalculatorPage(this.page).expectFieldError(field, message);
});

Then('the repayment summary should ask me to fix the highlighted field', async function (this: CustomWorld) {
  const calc = new CalculatorPage(this.page);
  await expect(calc.summaryStatus).toHaveText('Fix the highlighted field to see the repayment plan.');
  await expect(calc.result('Monthly EMI'), 'no stale EMI next to an invalid form').toHaveCount(0);
});

Then('the yearly chart and amortisation table should be hidden', async function (this: CustomWorld) {
  const calc = new CalculatorPage(this.page);
  await expect(calc.yearlyPayments.figure).toHaveCount(0);
  await expect(calc.schedule).toHaveCount(0);
});

When('the EMI service starts answering slowly', async function (this: CustomWorld) {
  await this.page.route(/\/api\/emi\?/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
});

Then('the repayment summary should be marked as busy', async function (this: CustomWorld) {
  const calc = new CalculatorPage(this.page);
  await expect(calc.summary).toHaveAttribute('aria-busy', 'true');
  await expect(calc.result('Monthly EMI'), 'the last good EMI stays visible while recalculating').toBeVisible();
});

// ---------------------------------------------------------------- reports

const FILTER_PARAM: Record<ReportFilter, { param: string; value: (v: string) => string }> = {
  'Loan type': { param: 'type', value: (v) => v.toLowerCase() },
  Status: { param: 'status', value: (v) => v.toLowerCase() },
  City: { param: 'city', value: (v) => v },
  'Min amount (₹)': { param: 'minAmount', value: (v) => v },
  'Max amount (₹)': { param: 'maxAmount', value: (v) => v },
  'Borrower or loan ID': { param: 'q', value: (v) => v },
};

When('I apply these report filters:', async function (this: CustomWorld, table: DataTable) {
  const reports = new ReportsPage(this.page);
  const expected: [string, string][] = [];
  for (const [name, raw] of Object.entries(table.rowsHash()) as [ReportFilter, string][]) {
    const value = raw.trim();
    if (!(name in FILTER_PARAM)) throw new Error(`Unknown report filter "${name}"`);
    if (!value) continue;
    await reports.setFilter(name, value);
    expected.push([FILTER_PARAM[name].param, FILTER_PARAM[name].value(value)]);
  }
  this.remember('filters', expected);
  await reports.applyButton.click();
  await reports.waitForResults();
});

Then('the address bar should carry exactly those filters', async function (this: CustomWorld) {
  const expected = this.recall<[string, string][]>('filters');
  await expect
    .poll(() => [...new URL(this.page.url()).searchParams.entries()].sort(), { message: 'query parameters in the address bar' })
    .toEqual([...expected].sort());
});

Then('the report should list exactly the loans the loan book has for the current query', async function (this: CustomWorld) {
  const reports = new ReportsPage(this.page);
  await reports.waitForResults();
  await expect(async () => {
    const query = currentQuery(this);
    const expected = expectedPage(query);
    expect(await reports.loanIds(), `loan IDs on screen for "?${query}"`).toEqual(expected.ids);
    if (expected.total) {
      const page = Number(new URLSearchParams(query).get('page') ?? 1);
      await expect(reports.rangeStatus).toHaveText(`Showing ${(page - 1) * 10 + 1}–${(page - 1) * 10 + expected.ids.length} of ${expected.total} loans`, { timeout: 1000 });
      await expect(reports.pageIndicator).toHaveText(`Page ${page} of ${expected.totalPages}`, { timeout: 1000 });
    }
  }).toPass({ timeout: env.timeouts.defaultMs });

  for (const row of await reports.rows()) {
    const loan = bookLoan(row.Loan);
    expect(row.Borrower, `${loan.id} borrower`).toBe(loan.borrower);
    expect(row.Type, `${loan.id} type`).toBe(capitalise(loan.type));
    expect(row.City, `${loan.id} city`).toBe(loan.city);
    expect(readNumber(row.Amount), `${loan.id} amount`).toBe(loan.amount);
    expect(row.Rate, `${loan.id} rate`).toBe(`${loan.rate.toFixed(2)}%`);
    expectRupees(readNumber(row.EMI), emiOf(loan), `${loan.id} EMI`);
    expect(readTenureMonths(row.Tenure), `${loan.id} tenure "${row.Tenure}"`).toBe(loan.tenureMonths);
    expect(readDisplayDate(row.Disbursed), `${loan.id} disbursed "${row.Disbursed}"`).toBe(loan.disbursedOn);
    expect(row.Status, `${loan.id} status`).toBe(capitalise(loan.status));
  }
  this.attach(`Oracle for ?${currentQuery(this)}: ${expectedPage(currentQuery(this)).ids.join(', ') || '(no loans)'}`, 'text/plain');
});

Then('the report totals should match the loan book for the current query', async function (this: CustomWorld) {
  const { totals } = new ReportsPage(this.page);
  await expect(async () => {
    const book = expectedSummary(currentQuery(this));
    await expect(totals.value('Matching loans')).toHaveText(String(book.count), { timeout: 1000 });
    expect(await totals.number('Total principal'), 'Total principal').toBe(book.totalPrincipal);
    await expect(totals.value('Weighted avg. rate')).toHaveText(`${book.weightedAverageRate.toFixed(2)}%`, { timeout: 1000 });
  }).toPass({ timeout: env.timeouts.defaultMs });
});

Then('the {string} chart should match the loan book for the current query', async function (this: CustomWorld, title: string) {
  const chart = new BarChart(this.page, title);
  await expect(async () => {
    const book = expectedSummary(currentQuery(this));
    const bars = await chart.readBars();
    expect(bars.map((b) => b.key)).toEqual(STATUSES);
    for (const bar of bars) {
      expect(bar.value, `${bar.key} principal`).toBe(book.byStatus[bar.key].principal);
      if (bar.value > 0) expect(bar.drawn, `${bar.key} bar should be drawn`).toBeGreaterThan(0);
    }
    expect(bars.reduce((sum, b) => sum + b.value, 0), 'bars add up to the total principal').toBe(book.totalPrincipal);
    expect(bars.some((b) => b.value > 0), 'at least one non-empty bar').toBe(true);
    expectDrawnToScale(bars);
  }).toPass({ timeout: env.timeouts.defaultMs });
});

Then('the report should say {string} and {string}', async function (this: CustomWorld, range: string, page: string) {
  const reports = new ReportsPage(this.page);
  await expect(reports.rangeStatus).toHaveText(range);
  await expect(reports.pageIndicator).toHaveText(page);
});

Then('the {string} filter should show {string}', async function (this: CustomWorld, filter: ReportFilter, option: string) {
  const reports = new ReportsPage(this.page);
  await expect.poll(() => reports.selectedOption(filter), { message: `${filter} filter` }).toBe(option);
});

When('I reset the report filters', async function (this: CustomWorld) {
  const reports = new ReportsPage(this.page);
  await reports.resetButton.click();
  await reports.waitForResults();
});

async function clickColumnHeader(world: CustomWorld, column: string, clicks: number) {
  const reports = new ReportsPage(world.page);
  for (let i = 0; i < clicks; i += 1) {
    const before = await reports.columnHeader(column).getAttribute('aria-sort');
    await reports.sortButton(column).click();
    // Each click flips the column's sort, so wait for that before clicking again.
    await expect(reports.columnHeader(column)).not.toHaveAttribute('aria-sort', before ?? '');
    await reports.waitForResults();
  }
}

When('I click the {string} column header once', async function (this: CustomWorld, column: string) {
  await clickColumnHeader(this, column, 1);
});

When('I click the {string} column header twice', async function (this: CustomWorld, column: string) {
  await clickColumnHeader(this, column, 2);
});

Then('the {string} column should be sorted {word}', async function (this: CustomWorld, column: string, direction: string) {
  await expect(new ReportsPage(this.page).columnHeader(column)).toHaveAttribute('aria-sort', direction);
});

Then('no other column should claim a sort order', async function (this: CustomWorld) {
  const states = await new ReportsPage(this.page).sortStates();
  const sorted = Object.entries(states).filter(([, s]) => s !== 'none');
  expect(sorted, `aria-sort of every sortable column: ${JSON.stringify(states)}`).toHaveLength(1);
});

Then('the {string} button should be disabled', async function (this: CustomWorld, name: string) {
  await expect(this.page.getByRole('button', { name, exact: true })).toBeDisabled();
});

When('I go to the next page of the report', async function (this: CustomWorld) {
  const reports = new ReportsPage(this.page);
  const before = await reports.pageIndicator.innerText();
  await reports.nextPage.click();
  await expect(reports.pageIndicator).not.toHaveText(before);
});

When('I go to the previous page of the report', async function (this: CustomWorld) {
  const reports = new ReportsPage(this.page);
  const before = await reports.pageIndicator.innerText();
  await reports.previousPage.click();
  await expect(reports.pageIndicator).not.toHaveText(before);
});

Then('the report should show its empty state', async function (this: CustomWorld) {
  const reports = new ReportsPage(this.page);
  await expect(reports.emptyStateHeading).toBeVisible();
  await expect(this.page.getByText(/^Widen the amount range/)).toBeVisible();
  await expect(reports.clearAllButton).toBeVisible();
  await expect(reports.table, 'no empty table next to the empty state').toHaveCount(0);
  await expect(reports.pagination).toHaveCount(0);
});

Then('the report totals should show {int} matching loans', async function (this: CustomWorld, count: number) {
  await expect(new ReportsPage(this.page).totals.value('Matching loans')).toHaveText(String(count));
});

When('I clear all filters from the empty state', async function (this: CustomWorld) {
  const reports = new ReportsPage(this.page);
  await reports.clearAllButton.click();
  await reports.waitForResults();
});

Then('the report should explain that {string}', async function (this: CustomWorld, title: string) {
  await expect(new ReportsPage(this.page).errorAlert).toContainText(title);
});

Then('the explanation should name the {string} and {string} filters', async function (this: CustomWorld, a: string, b: string) {
  const alert = new ReportsPage(this.page).errorAlert;
  await expect(alert).toContainText(a);
  await expect(alert).toContainText(b);
  await expect(new ReportsPage(this.page).table, 'no table under an error').toHaveCount(0);
});

// ---------------------------------------------------------------- loan detail

When('I open loan {string} from the report', async function (this: CustomWorld, id: string) {
  await new ReportsPage(this.page).loanLink(id).click();
});

Then('the loan detail page should describe loan {string} exactly as the loan book records it', async function (this: CustomWorld, id: string) {
  const loan = bookLoan(id);
  const detail = new LoanDetailPage(this.page, id);
  await detail.waitUntilLoaded();
  this.attachJson(`Loan book record ${id}`, loan);
  await expect(detail.heading).toHaveText(`${id} · ${loan.borrower}`);
  const summary = (await detail.summaryLine(capitalise(loan.type)).innerText()).match(/^(\w+) loan in (.+), disbursed (.+)\.$/);
  expect(summary, 'summary line "<Type> loan in <City>, disbursed <date>."').not.toBeNull();
  expect([summary![1], summary![2]]).toEqual([capitalise(loan.type), loan.city]);
  expect(readDisplayDate(summary![3]), `disbursed "${summary![3]}"`).toBe(loan.disbursedOn);
  await expect(detail.status(capitalise(loan.status))).toBeVisible();
  expect(await detail.keyFigures.number('Principal'), 'Principal').toBe(loan.amount);
  await expect(detail.keyFigures.value('Interest rate')).toHaveText(`${loan.rate.toFixed(2)}%`);
  await expect(detail.keyFigures.figure('Tenure')).toContainText(`${loan.tenureMonths} monthly payments`);
  const tenure = await detail.keyFigures.value('Tenure').innerText();
  expect(readTenureMonths(tenure), `Tenure "${tenure}"`).toBe(loan.tenureMonths);
  expectRupees(await detail.keyFigures.number('Monthly EMI'), emiOf(loan), 'Monthly EMI');
});

Given('the API answers loan {string} with a tenure of {int} months', async function (this: CustomWorld, id: string, months: number) {
  await this.page.route(`**/api/loans/${id}`, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { data: { tenureMonths: number } };
    body.data.tenureMonths = months;
    await route.fulfill({ response, json: body });
  });
});

Then('the tenure should read back as {int} monthly payments', async function (this: CustomWorld, months: number) {
  const id = new URL(this.page.url()).pathname.split('/').pop()!;
  const detail = new LoanDetailPage(this.page, id);
  await detail.waitUntilLoaded();
  await expect(detail.keyFigures.figure('Tenure')).toContainText(`${months} monthly payments`);
  const tenure = await detail.keyFigures.value('Tenure').innerText();
  this.attach(`Tenure shown: "${tenure}" for ${months} months`, 'text/plain');
  expect(readTenureMonths(tenure), `Tenure "${tenure}"`).toBe(months);
});

Then('the repayment chart should have one bar per calendar year from the disbursement month', async function (this: CustomWorld) {
  const id = new URL(this.page.url()).pathname.split('/').pop()!;
  const schedule = bookLoanSchedule(bookLoan(id));
  const bars = await new LoanDetailPage(this.page, id).repayment.readBars();
  expect(bars.map((b) => b.key)).toEqual(schedule.map((r) => String(r.year)));
});

Then('every repayment bar should match my own amortisation of the loan', async function (this: CustomWorld) {
  const id = new URL(this.page.url()).pathname.split('/').pop()!;
  const loan = bookLoan(id);
  const bars = await new LoanDetailPage(this.page, id).repayment.readBars();
  expectBarsMatchSchedule(bars, bookLoanSchedule(loan));
});

Then('the cost of the loan should match my own amortisation', async function (this: CustomWorld) {
  const id = new URL(this.page.url()).pathname.split('/').pop()!;
  const loan = bookLoan(id);
  const detail = new LoanDetailPage(this.page, id);
  const mine = expectedEmi({ principal: loan.amount, annualRatePct: loan.rate, months: loan.tenureMonths });
  const schedule = bookLoanSchedule(loan);
  await expectAmountOnScreen(detail.fact('Total interest'), mine.totalInterest, 'Total interest');
  await expectAmountOnScreen(detail.fact('Total payment'), mine.totalPayment, 'Total payment');
  await expect(detail.fact('Calendar years')).toHaveText(`${schedule[0].year}–${schedule.at(-1)!.year}`);
  await expect(detail.fact('Borrower')).toHaveText(loan.borrower);
});

// ---------------------------------------------------------------- hostile input

When('I clear the {string} box and press the keys {string}', async function (this: CustomWorld, field: CalculatorField, keys: string) {
  const box = new CalculatorPage(this.page).box(field);
  await box.clear();
  // Key by key, as a person types: the browser decides what a number box accepts.
  await box.pressSequentially(keys);
  const shown = await box.inputValue();
  this.attach(`Pressed ${JSON.stringify(keys)}; the box holds ${JSON.stringify(shown)}`, 'text/plain');
  const n = Number(shown);
  if (shown.trim() !== '' && Number.isFinite(n)) {
    const key = ({ 'Loan amount': 'principal', 'Interest rate': 'ratePct', 'Loan tenure': 'tenure' } as const)[field];
    this.remember<LoanEntry>('loan', { ...this.recall<LoanEntry>('loan'), [key]: n });
  }
});

Then('the report should note {string}', async function (this: CustomWorld, text: string) {
  await expect(new ReportsPage(this.page).pageNote).toHaveText(text);
});

Then('the report should say there is no page {string} and that it has {int} pages', async function (this: CustomWorld, page: string, pages: number) {
  const reports = new ReportsPage(this.page);
  await expect(reports.pastEndHeading).toHaveText(`There is no page ${page}`);
  await expect(this.page.getByText(`This report has ${pages} pages.`, { exact: true })).toBeVisible();
  await expect(reports.rangeStatus, 'no impossible "Showing" range').toHaveCount(0);
  await expect(reports.table, 'no empty table').toHaveCount(0);
  await expect(reports.pagination).toHaveCount(0);
});

When('I go to the last page from that message', async function (this: CustomWorld) {
  const reports = new ReportsPage(this.page);
  await reports.lastPageButton.click();
  await reports.waitForResults();
});

Then('no browser dialog should have opened', function (this: CustomWorld) {
  expect(this.dialogs, 'text from the URL or a field must never run as script').toEqual([]);
});

Given('I open the LoanLens address {string}', async function (this: CustomWorld, address: string) {
  await this.page.goto(`${env.app.baseUrl}${address}`);
  await expect(this.page.getByRole('heading', { level: 1 })).toBeVisible();
});

Then('the page should show {string} as plain text', async function (this: CustomWorld, text: string) {
  await expect
    .poll(
      () => this.page.evaluate((t) => document.body.innerText.includes(t) || Array.from(document.querySelectorAll('input')).some((i) => i.value === t), text),
      { message: `"${text}" should be on the page, as text or as a box's value` },
    )
    .toBe(true);
});

// Parses the markup in an inert <template>, then counts live elements with the same tag and
// attributes. Zero means the app escaped the text; the CSP check below says nothing had to be blocked.
Then('no element should have been built from {string}', async function (this: CustomWorld, markup: string) {
  const built = await this.page.evaluate((m) => {
    const template = document.createElement('template');
    template.innerHTML = m;
    const probe = template.content.firstElementChild;
    if (!probe) return 0;
    return Array.from(document.querySelectorAll(probe.tagName)).filter((el) => Array.from(probe.attributes).every((a) => el.getAttribute(a.name) === a.value)).length;
  }, markup);
  expect(built, `elements built from ${markup}`).toBe(0);
});

Then('the Content-Security-Policy should not have had to block anything', function (this: CustomWorld) {
  expect(this.cspViolations, 'the app must escape the text itself; the policy is only the second line of defence').toEqual([]);
});

/** "default-src 'self'; img-src 'self' data:" -> { 'default-src': "'self'", 'img-src': "'self' data:" } */
function cspDirectives(policy: string): Record<string, string> {
  return Object.fromEntries(
    policy
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter((words) => words[0])
      .map(([name, ...sources]) => [name.toLowerCase(), sources.join(' ')]),
  );
}

Then('the LoanLens page {string} should be served with these headers:', async function (this: CustomWorld, address: string, table: DataTable) {
  const res = await this.page.request.get(`${env.app.baseUrl}${address}`);
  const headers = res.headers();
  this.attach(`GET ${address} -> ${res.status()}\n${Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n')}`, 'text/plain');
  for (const { header, directive, value } of table.hashes()) {
    const sent = headers[header.toLowerCase()] ?? '(absent)';
    if (directive) expect(cspDirectives(sent)[directive] ?? '(absent)', `${header} ${directive} on ${address}`).toBe(value);
    else expect(sent, `${header} on ${address}`).toBe(value);
  }
});

When('I send a {word} request to the LoanLens page {string}', async function (this: CustomWorld, method: string, address: string) {
  const res = await this.page.request.fetch(`${env.app.baseUrl}${address}`, { method, maxRedirects: 0 });
  const body = await res.text();
  this.scenario.pageResponse = { status: res.status(), headers: res.headers(), body };
  this.attach(`${method} ${address} -> ${res.status()}\n${body.slice(0, 400)}`, 'text/plain');
});

type PageResponse = { status: number; headers: Record<string, string>; body: string };

Then('the page response should be a JSON 405 that allows only {string}', function (this: CustomWorld, allow: string) {
  const res = this.scenario.pageResponse as PageResponse;
  expect(res.status, 'status').toBe(405);
  expect(res.headers['allow'], 'Allow').toBe(allow);
  expect(res.headers['content-type'], 'content type').toMatch(/^application\/json/);
  expect((JSON.parse(res.body) as { error: { code: string } }).error.code).toBe('METHOD_NOT_ALLOWED');
});

Then('the page response should be the app\'s own page, not {string}', function (this: CustomWorld, file: string) {
  const res = this.scenario.pageResponse as PageResponse;
  expect(res.body, `the contents of ${file}`).not.toContain('"devDependencies"');
  expect(res.body, 'the LoanLens page').toContain('<div id="root">');
});
