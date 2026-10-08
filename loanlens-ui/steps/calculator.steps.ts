import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../../framework/support/world.js';
import { expectedEmi, loanYearSchedule, parseIndianAmount, readNumber, type LoanInput } from '../../framework/oracles/emi.js';
import { expectAmountOnScreen, expectRupees } from '../money.js';
import { CalculatorPage, type CalculatorField, type LoanEntry } from '../pages/CalculatorPage.js';

const calculator = (world: CustomWorld) => new CalculatorPage(world.page);
const loanInput = (entry: LoanEntry): LoanInput => ({ principal: entry.principal, annualRatePct: entry.ratePct, months: entry.years * 12 });
const FIELD_KEY: Record<CalculatorField, keyof LoanEntry> = { 'Loan amount': 'principal', 'Interest rate': 'ratePct', 'Loan tenure': 'years' };

When('I enter a loan of {string} at {float}% for {int} years', async function (this: CustomWorld, amount: string, ratePct: number, years: number) {
  const entry = this.remember<LoanEntry>('loan', { principal: parseIndianAmount(amount), ratePct, years });
  await calculator(this).enterLoan(entry);
});

When('I type {string} into the {string} box', async function (this: CustomWorld, value: string, field: CalculatorField) {
  await calculator(this).box(field).fill(value);
  // A valid entry changes the loan the expected figures are worked out for.
  if (/^\d+(\.\d+)?$/.test(value)) this.recall<LoanEntry>('loan')[FIELD_KEY[field]] = Number(value);
});

Then('the monthly EMI should read {string}', async function (this: CustomWorld, emi: string) {
  await expect(calculator(this).result('Monthly EMI')).toHaveText(emi);
});

Then('the monthly EMI, total interest and total payment should match my own calculation', async function (this: CustomWorld) {
  const page = calculator(this);
  const expected = expectedEmi(loanInput(this.recall<LoanEntry>('loan')));
  await expectAmountOnScreen(page.result('Monthly EMI'), expected.emi, 'Monthly EMI');
  await expectAmountOnScreen(page.result('Total interest'), expected.totalInterest, 'Total interest');
  await expectAmountOnScreen(page.result('Total payment'), expected.totalPayment, 'Total payment');
});

Then('the yearly payments chart should show one non-zero bar per loan year', async function (this: CustomWorld) {
  const bars = await calculator(this).yearlyPayments.readMarks();
  const schedule = loanYearSchedule(loanInput(this.recall<LoanEntry>('loan')));
  expect(bars.map((b) => b.key), 'one bar per loan year, in order').toEqual(schedule.map((r) => String(r.year)));
  for (const bar of bars) {
    expect(bar.value, `year ${bar.key} total`).toBeGreaterThan(0);
    expect(Object.values(bar.segments).reduce((sum, s) => sum + s.height, 0), `year ${bar.key} drawn height`).toBeGreaterThan(0);
  }
});

Then('every yearly bar should match my own amortisation', async function (this: CustomWorld) {
  const bars = await calculator(this).yearlyPayments.readMarks();
  const schedule = loanYearSchedule(loanInput(this.recall<LoanEntry>('loan')));
  bars.forEach((bar, i) => {
    const row = schedule[i];
    expectRupees(bar.segments.principal.value, row.principal, `year ${row.year} principal`);
    expectRupees(bar.segments.interest.value, row.interest, `year ${row.year} interest`);
    const named = /^Year (\d+): Principal (₹[\d,]+), Interest (₹[\d,]+), total (₹[\d,]+)$/.exec(bar.name);
    expect(named, `year ${row.year} accessible name "${bar.name}"`).not.toBeNull();
    expectRupees(readNumber(named![2]), row.principal, `year ${row.year} principal in the bar's name`);
    expectRupees(readNumber(named![3]), row.interest, `year ${row.year} interest in the bar's name`);
    expectRupees(readNumber(named![4]), row.principal + row.interest, `year ${row.year} total in the bar's name`);
  });
  // The data can be right while the drawing is wrong: every segment's height must be its value at one common scale.
  const segments = bars.flatMap((bar) => Object.entries(bar.segments).map(([key, s]) => ({ label: `year ${bar.key} ${key}`, ...s })));
  const pxPerRupee = segments.reduce((sum, s) => sum + s.height, 0) / segments.reduce((sum, s) => sum + s.value, 0);
  for (const s of segments) {
    expect(Math.abs(s.height - s.value * pxPerRupee), `${s.label} drawn ${s.height.toFixed(1)}px for ₹${Math.round(s.value)}`).toBeLessThanOrEqual(1);
  }
});

Then('the {string} box should show the error {string}', async function (this: CustomWorld, field: CalculatorField, message: string) {
  await calculator(this).expectFieldError(field, message);
});

Then('the repayment summary and the chart should be hidden', async function (this: CustomWorld) {
  const page = calculator(this);
  await expect(page.summary.getByRole('status')).toHaveText(/^Fix the highlighted field/);
  await expect(page.result('Monthly EMI')).toHaveCount(0);
  await expect(page.yearlyPayments.figure).toHaveCount(0);
});

Then('the {string} box should contain {string}', async function (this: CustomWorld, field: CalculatorField, value: string) {
  await expect(calculator(this).box(field)).toHaveValue(value);
});
