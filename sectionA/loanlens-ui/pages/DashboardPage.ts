import { expect } from '@playwright/test';
import type { Locator, Page } from 'playwright';
import { BarChart, DonutChart, KeyFigures, readTable, type TableRow } from './components.js';
import { LoanLensPage } from './LoanLensPage.js';

export class DashboardPage extends LoanLensPage {
  readonly keyFigures: KeyFigures;
  readonly principalByType: DonutChart;
  readonly loansByStatus: BarChart;
  readonly recentTable: Locator;
  readonly viewAllLink: Locator;
  readonly reportLink: Locator;

  constructor(page: Page) {
    super(page, '/');
    this.keyFigures = new KeyFigures(page.getByRole('main'));
    this.principalByType = new DonutChart(page, 'Principal by loan type');
    this.loansByStatus = new BarChart(page, 'Loans by status');
    this.recentTable = page.getByRole('table', { name: 'Recent disbursements' });
    this.viewAllLink = page.getByRole('link', { name: 'View all' });
    this.reportLink = page.getByRole('link', { name: 'Open loan book report' });
  }

  async waitUntilLoaded(): Promise<void> {
    await expect(this.heading).toHaveText('Portfolio overview');
    await this.waitForPlaceholdersToClear();
    await expect(this.keyFigures.value('Total loans')).toBeVisible();
    await expect(this.recentTable).toBeVisible();
  }

  recentLoanLink(id: string): Locator {
    return this.recentTable.getByRole('link', { name: id, exact: true });
  }

  recentRows(): Promise<TableRow[]> {
    return readTable(this.recentTable);
  }
}
