import { After, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../../framework/support/world.js';
import { loanBook, mostRecentLoans } from '../../framework/oracles/loan-book.js';
import { readTable } from '../../loanlens-ui/pages/components.js';
import { recordReplay } from '../healer.js';
import { LegacyLocators } from '../pages/LegacyLocators.js';

/** Claude may take a while to answer, and a healed step still has to finish. */
const HEALING = { timeout: 240_000 };

const legacy = (world: CustomWorld) =>
  new LegacyLocators(world.page, { name: world.scenarioName, attach: (text) => world.attach(text, 'text/plain') });

After(function (this: CustomWorld, { result }) {
  recordReplay(this.scenarioName, result?.status === 'PASSED');
});

Then('the legacy Total loans figure should equal the number of loans in the loan book', HEALING, async function (this: CustomWorld) {
  await expect(await legacy(this).totalLoansValue.resolve()).toHaveText(String(loanBook().length));
});

When('I open the EMI calculator with the legacy navigation link', HEALING, async function (this: CustomWorld) {
  await (await legacy(this).calculatorLink.resolve()).click();
});

When('I set the loan amount to {int} with the legacy slider', HEALING, async function (this: CustomWorld, amount: number) {
  await (await legacy(this).loanAmountSlider.resolve()).fill(String(amount));
});

Then('the legacy recent disbursements table should start with the most recently disbursed loan', HEALING, async function (this: CustomWorld) {
  const [newest] = await readTable(await legacy(this).recentDisbursementsTable.resolve());
  expect(newest?.Loan).toBe(mostRecentLoans(1)[0].id);
});

When('I press the legacy Export CSV button', HEALING, async function (this: CustomWorld) {
  const button = await legacy(this).exportCsvButton.resolve();
  const [download] = await Promise.all([this.page.waitForEvent('download', { timeout: 10_000 }), button.click()]);
  this.remember('download', download.suggestedFilename());
});

Then('a CSV file of the loans should be downloaded', function (this: CustomWorld) {
  expect(this.recall<string>('download')).toMatch(/\.csv$/);
});
