import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../../framework/support/world.js';
import { readNumber } from '../../framework/oracles/emi.js';
import { expectedSummary, LOAN_TYPES, mostRecentLoans } from '../../framework/oracles/loan-book.js';
import { expectAmountOnScreen } from '../money.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { Chart } from '../pages/components.js';

const dashboard = (world: CustomWorld) => new DashboardPage(world.page);

Then('the dashboard key figures should match the loan book', async function (this: CustomWorld) {
  const page = dashboard(this);
  const expected = expectedSummary();
  expect(readNumber(await page.keyFigure('Total loans').innerText()), 'Total loans').toBe(expected.count);
  await expectAmountOnScreen(page.keyFigure('Principal disbursed'), expected.totalPrincipal, 'Principal disbursed');
  const rate = readNumber(await page.keyFigure('Weighted avg. rate').innerText());
  expect(Math.abs(rate - expected.weightedAverageRate), `Weighted avg. rate: shown ${rate}%, expected ${expected.weightedAverageRate}%`).toBeLessThanOrEqual(0.005);
  await expectAmountOnScreen(page.keyFigure('Monthly EMI inflow'), expected.monthlyEmiInflow, 'Monthly EMI inflow');
});

Then('the recent disbursements table should list the {int} most recently disbursed loans', async function (this: CustomWorld, count: number) {
  const rows = await dashboard(this).recentRows();
  expect(rows.map((r) => r.Loan)).toEqual(mostRecentLoans(count).map((l) => l.id));
});

Then('the {string} donut should draw one non-zero slice per loan type with the loan book\'s principal', async function (this: CustomWorld, title: string) {
  const slices = await new Chart(this.page, title).readMarks();
  const { principalByType } = expectedSummary();
  expect(slices.map((s) => s.key), 'one slice per loan type').toEqual([...LOAN_TYPES]);
  for (const slice of slices) {
    expect(slice.value, `${slice.key} slice`).toBeGreaterThan(0);
    expect(slice.value, `${slice.key} slice`).toBe(principalByType[slice.key]);
    expect(readNumber(slice.name.split(':')[1]), `${slice.key} slice's accessible name "${slice.name}"`).toBe(principalByType[slice.key]);
  }
});

Then('the {string} donut\'s legend should total the loan book\'s principal', async function (this: CustomWorld, title: string) {
  const total = new Chart(this.page, title).legend.getByRole('row', { name: /^Total/ }).getByRole('cell', { name: /^₹/ });
  expect(readNumber(await total.innerText())).toBe(expectedSummary().totalPrincipal);
});
