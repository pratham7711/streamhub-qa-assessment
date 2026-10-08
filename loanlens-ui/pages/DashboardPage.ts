import { expect } from '@playwright/test';
import type { Locator, Page } from 'playwright';
import { Chart, readTable, type TableRow } from './components.js';
import { LoanLensPage } from './LoanLensPage.js';

export class DashboardPage extends LoanLensPage {
  readonly principalByType: Chart;
  readonly recentTable: Locator;

  constructor(page: Page) {
    super(page, '/');
    this.principalByType = new Chart(page, 'Principal by loan type');
    this.recentTable = page.getByRole('table', { name: 'Recent disbursements' });
  }

  async waitUntilLoaded(): Promise<void> {
    await expect(this.heading).toHaveText('Portfolio overview');
    await expect(this.recentTable).toBeVisible();
  }

  /** A key figure's value. Each figure is a group named by its label. */
  keyFigure(label: string): Locator {
    return this.page.getByRole('group', { name: label, exact: true }).getByTestId('kpi-value');
  }

  recentRows(): Promise<TableRow[]> {
    return readTable(this.recentTable);
  }
}
