import { expect } from '@playwright/test';
import type { Locator, Page } from 'playwright';
import { Chart } from './components.js';
import { LoanLensPage } from './LoanLensPage.js';

export type CalculatorField = 'Loan amount' | 'Interest rate' | 'Loan tenure';

export interface LoanEntry {
  principal: number;
  ratePct: number;
  years: number;
}

export class CalculatorPage extends LoanLensPage {
  readonly form: Locator;
  readonly summary: Locator;
  readonly yearlyPayments: Chart;

  constructor(page: Page) {
    super(page, '/calculator');
    this.form = page.getByRole('form', { name: 'Loan details' });
    this.summary = page.getByRole('region', { name: 'Repayment summary' });
    this.yearlyPayments = new Chart(page, 'Yearly payments');
  }

  async waitUntilLoaded(): Promise<void> {
    await expect(this.heading).toHaveText('EMI calculator');
    await expect(this.result('Monthly EMI')).toBeVisible();
  }

  /** The number box for a field. Its slider carries the same label, so the role tells them apart. */
  box(field: CalculatorField): Locator {
    return this.form.getByRole('spinbutton', { name: field, exact: true });
  }

  /** "Monthly EMI", "Total interest" or "Total payment": each is a group named by its label. */
  result(label: string): Locator {
    return this.summary.getByRole('group', { name: label, exact: true }).getByRole('definition');
  }

  async enterLoan(entry: LoanEntry): Promise<void> {
    await this.box('Loan amount').fill(String(entry.principal));
    await this.box('Interest rate').fill(String(entry.ratePct));
    await this.box('Loan tenure').fill(String(entry.years));
  }

  async expectFieldError(field: CalculatorField, message: string): Promise<void> {
    const box = this.box(field);
    await expect(this.form.getByText(message, { exact: true }), `${field} error message`).toBeVisible();
    await expect(box).toHaveAttribute('aria-invalid', 'true');
    await expect(box, 'the error should be announced with the field').toHaveAccessibleDescription(message);
  }
}
