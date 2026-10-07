import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { LegacyLocators } from '../pages/LegacyLocators.js';
import type { CustomWorld } from '../../../framework/support/world.js';
import { loanBook, sortBook } from '../../../framework/oracles/loan-book.js';

/** An LLM provider may take a while to answer, and a healed step still has to finish. */
const HEALING = { timeout: 240_000 };

const legacy = (world: CustomWorld) => new LegacyLocators(world.page);

Then('the legacy Total loans figure should equal the number of loans in the loan book', HEALING, async function (this: CustomWorld) {
  const value = await legacy(this).totalLoansValue.resolve();
  await expect(value).toHaveText(String(loanBook().length));
});

When('I filter the report to {string} loans with the legacy Apply button', HEALING, async function (this: CustomWorld, status: string) {
  const page = legacy(this);
  await page.statusFilter().selectOption(status);
  await (await page.applyFiltersButton.resolve()).click();
  await expect(this.page).toHaveURL(new RegExp(`[?&]status=${status.toLowerCase()}`));
});

When('I set the loan amount to {int} with the legacy slider', HEALING, async function (this: CustomWorld, amount: number) {
  const slider = await legacy(this).loanAmountSlider.resolve();
  await slider.fill(String(amount));
});

Then('the legacy recent disbursements table should start with the most recently disbursed loan', HEALING, async function (this: CustomWorld) {
  const table = await legacy(this).recentDisbursementsTable.resolve();
  const latest = sortBook(loanBook(), '-disbursedOn')[0];
  await expect(table.getByRole('row').nth(1).getByRole('link')).toHaveText(latest.id);
});

When('I press the legacy Export CSV button', HEALING, async function (this: CustomWorld) {
  const button = await legacy(this).exportCsvButton.resolve();
  const [download] = await Promise.all([this.page.waitForEvent('download', { timeout: 10_000 }), button.click()]);
  this.remember('download', download);
});

Then('a CSV file of the loans should be downloaded', async function (this: CustomWorld) {
  const download = this.recall<{ suggestedFilename(): string }>('download');
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});
