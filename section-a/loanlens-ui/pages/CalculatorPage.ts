import { expect } from '@playwright/test';
import type { Locator, Page } from 'playwright';
import { BarChart, DonutChart, escapeRegExp, readTable, readTableFooter, type TableRow } from './components.js';
import { LoanLensPage } from './LoanLensPage.js';

export type CalculatorField = 'Loan amount' | 'Interest rate' | 'Loan tenure';
export type TenureUnit = 'years' | 'months';

export interface LoanEntry {
  principal: number;
  ratePct: number;
  tenure: number;
  unit: TenureUnit;
  /** YYYY-MM */
  startMonth: string;
}

export class CalculatorPage extends LoanLensPage {
  readonly form: Locator;
  readonly startMonth: Locator;
  readonly summary: Locator;
  readonly summaryStatus: Locator;
  readonly breakUp: DonutChart;
  readonly yearlyPayments: BarChart;
  readonly schedule: Locator;

  constructor(page: Page) {
    super(page, '/calculator');
    this.form = page.getByRole('form', { name: 'Loan details' });
    this.startMonth = this.form.getByLabel('First EMI month');
    this.summary = page.getByRole('region', { name: 'Repayment summary' });
    this.summaryStatus = this.summary.getByRole('status');
    this.breakUp = new DonutChart(this.summary, 'Break-up of total payment');
    this.yearlyPayments = new BarChart(page, 'Yearly payments');
    this.schedule = page.getByRole('table', { name: 'Yearly amortisation schedule' });
  }

  async waitUntilLoaded(): Promise<void> {
    await expect(this.heading).toHaveText('EMI calculator');
    await this.waitForResults();
  }

  /** The number box for a field (role spinbutton, labelled by the field label). */
  box(field: CalculatorField): Locator {
    return this.form.getByRole('spinbutton', { name: field, exact: true });
  }

  /** The range slider for a field (role slider, labelled by the same field label). */
  slider(field: CalculatorField): Locator {
    return this.form.getByRole('slider', { name: field, exact: true });
  }

  unitOption(unit: TenureUnit): Locator {
    return this.form.getByRole('radio', { name: unit === 'years' ? 'Years' : 'Months', exact: true });
  }

  /** One of the headline figures: "Monthly EMI", "Total interest" or "Total payment". */
  result(label: string): Locator {
    return this.summary.getByRole('group', { name: label, exact: true }).getByTestId('result-value');
  }

  errorFor(message: string): Locator {
    return this.form.getByText(message, { exact: true });
  }

  /** Waits for the debounce and the recalculation to finish. */
  async waitForResults(): Promise<void> {
    await expect(this.summary, 'the repayment summary should finish recalculating').toHaveAttribute('aria-busy', 'false');
    await expect(this.result('Monthly EMI')).toBeVisible();
  }

  async enterLoan(entry: LoanEntry): Promise<void> {
    await this.unitOption(entry.unit).check();
    await this.box('Loan amount').fill(String(entry.principal));
    await this.box('Interest rate').fill(String(entry.ratePct));
    await this.box('Loan tenure').fill(String(entry.tenure));
    await this.startMonth.fill(entry.startMonth);
    await this.waitForResults();
  }

  /** Moves a slider to `target` with the arrow keys, the way a keyboard user would. */
  async slideTo(field: CalculatorField, target: number): Promise<void> {
    const slider = this.slider(field);
    const step = Number(await slider.getAttribute('step'));
    const current = Number(await slider.inputValue());
    const presses = Math.round((target - current) / step);
    await slider.focus();
    for (let i = 0; i < Math.abs(presses); i += 1) {
      await slider.press(presses > 0 ? 'ArrowRight' : 'ArrowLeft');
    }
    await expect(slider, `${field} slider`).toHaveValue(String(target));
  }

  async expectFieldError(field: CalculatorField, message: string): Promise<void> {
    const box = this.box(field);
    await expect(this.errorFor(message), `${field} error message`).toBeVisible();
    await expect(box).toHaveAttribute('aria-invalid', 'true');
    await expect(box, 'the error should be announced with the field').toHaveAccessibleDescription(new RegExp(escapeRegExp(message)));
  }

  scheduleRows(): Promise<TableRow[]> {
    return readTable(this.schedule);
  }

  scheduleTotals(): Promise<TableRow | undefined> {
    return readTableFooter(this.schedule);
  }
}
