import { expect } from '@playwright/test';
import type { Locator, Page } from 'playwright';
import { BarChart, KeyFigures } from './components.js';
import { LoanLensPage } from './LoanLensPage.js';

export class LoanDetailPage extends LoanLensPage {
  readonly keyFigures: KeyFigures;
  readonly repayment: BarChart;
  readonly breadcrumb: Locator;
  readonly searchBookLink: Locator;

  constructor(page: Page, readonly loanId: string) {
    super(page, `/loans/${encodeURIComponent(loanId)}`);
    this.keyFigures = new KeyFigures(page.getByRole('main'));
    this.repayment = new BarChart(page, 'Repayment by year');
    this.breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    this.searchBookLink = page.getByRole('link', { name: 'Search the loan book' });
  }

  async waitUntilLoaded(): Promise<void> {
    await this.waitForPlaceholdersToClear();
    await expect(this.heading).toBeVisible();
  }

  /** A fact in the "Cost of the loan" panel: Total interest, Total payment, Calendar years or Borrower. */
  fact(label: string): Locator {
    return this.page.getByRole('group', { name: label, exact: true }).getByRole('definition');
  }

  /** The one-line summary under the heading, e.g. "Car loan in Hyderabad, disbursed 22 Mar 2023." */
  summaryLine(type: string): Locator {
    return this.page.getByRole('main').getByText(new RegExp(`^${type} loan in `));
  }

  status(label: string): Locator {
    return this.page.getByRole('main').getByText(label, { exact: true });
  }
}
