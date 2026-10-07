import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { Locator } from 'playwright';
import { LegacyEmiLocators } from '../pages/LegacyEmiLocators.js';
import { EmiCalculatorPage } from '../../emicalculator/pages/EmiCalculatorPage.js';
import type { CustomWorld } from '../../framework/support/world.js';
import type { LoanInput } from '../../framework/oracles/emi.js';

/** An LLM provider may take a while to answer, and a healed step still has to finish. */
const HEALING = { timeout: 240_000 };

const legacy = (world: CustomWorld) => new LegacyEmiLocators(world.page);

/** The same page object the emicalculator steps use, so "the EMI shown" steps read this scenario's page. */
function calculator(world: CustomWorld): EmiCalculatorPage {
  return (world.scenario.emiPage as EmiCalculatorPage | undefined) ?? world.remember('emiPage', new EmiCalculatorPage(world.page));
}

/**
 * Types through a legacy locator, then reads all three boxes back through the healthy page
 * object. If a healed locator found the wrong box, the value lands elsewhere and this fails;
 * otherwise the loan the page now holds is what the EMI is checked against.
 */
async function typeAndReadBack(world: CustomWorld, box: Locator, value: number, field: 'amount' | 'rate' | 'tenure') {
  const page = calculator(world);
  await page.typeInto(box, value);
  await page.waitForResultsToSettle();
  const held = await page.inputValues();
  expect(held[field], `the ${field} box should hold the ${value} typed through the legacy locator`).toBe(value);
  world.remember<LoanInput>('loan', { principal: held.amount, annualRatePct: held.rate, months: held.tenure * 12 });
}

When('I type a tenure of {int} years into the legacy tenure box', HEALING, async function (this: CustomWorld, years: number) {
  await typeAndReadBack(this, await legacy(this).loanTenureBox.resolve(), years, 'tenure');
});

When('I type a loan amount of {int} into the legacy amount box', HEALING, async function (this: CustomWorld, amount: number) {
  await typeAndReadBack(this, await legacy(this).homeLoanAmountBox.resolve(), amount, 'amount');
});

When('I type an interest rate of {float} into the legacy rate box', HEALING, async function (this: CustomWorld, rate: number) {
  await typeAndReadBack(this, await legacy(this).interestRateBox.resolve(), rate, 'rate');
});

When('I open the Personal Loan tab with the legacy tab link', HEALING, async function (this: CustomWorld) {
  await (await legacy(this).personalLoanTab.resolve()).click();
});

Then('the amount box should be labelled {string}', async function (this: CustomWorld, label: string) {
  await expect(this.page.getByLabel(label, { exact: true })).toBeVisible();
});

When('I press the legacy Email schedule button', HEALING, async function (this: CustomWorld) {
  await (await legacy(this).emailScheduleButton.resolve()).click();
});

Then('a form to e-mail the schedule should open', async function (this: CustomWorld) {
  await expect(this.page.getByRole('dialog', { name: /e-?mail/i })).toBeVisible();
});
