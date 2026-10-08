import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../../framework/support/world.js';
import { CalculatorPage } from '../pages/CalculatorPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { LoanLensPage } from '../pages/LoanLensPage.js';

const screen = (world: CustomWorld) => new LoanLensPage(world.page, '');

Given('I open the LoanLens dashboard', async function (this: CustomWorld) {
  await new DashboardPage(this.page).open();
});

Given('I open the LoanLens EMI calculator', async function (this: CustomWorld) {
  await new CalculatorPage(this.page).open();
});

When('I follow the {string} link in the main navigation', async function (this: CustomWorld, name: string) {
  await screen(this).navLink(name).click();
});

Then('the address bar should show {string}', async function (this: CustomWorld, pathname: string) {
  await expect.poll(() => new URL(this.page.url()).pathname).toBe(pathname);
});

Then('the LoanLens screen heading should be {string}', async function (this: CustomWorld, heading: string) {
  await expect(screen(this).heading).toHaveText(heading);
});

Then('the browser tab title should be {string}', async function (this: CustomWorld, title: string) {
  await expect(this.page).toHaveTitle(title);
});

Then('I capture evidence {string}', async function (this: CustomWorld, label: string) {
  await this.captureEvidence(label);
});
