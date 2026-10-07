import { expect } from '@playwright/test';
import type { Locator, Page } from 'playwright';
import { BarChart, KeyFigures, readTable, type TableRow } from './components.js';
import { LoanLensPage } from './LoanLensPage.js';

export type ReportFilter = 'Loan type' | 'Status' | 'City' | 'Min amount (₹)' | 'Max amount (₹)' | 'Borrower or loan ID';

export const SELECT_FILTERS: ReportFilter[] = ['Loan type', 'Status', 'City'];

export class ReportsPage extends LoanLensPage {
  readonly form: Locator;
  readonly applyButton: Locator;
  readonly resetButton: Locator;
  readonly totals: KeyFigures;
  readonly table: Locator;
  readonly rangeStatus: Locator;
  readonly pagination: Locator;
  readonly nextPage: Locator;
  readonly previousPage: Locator;
  readonly pageIndicator: Locator;
  readonly principalByStatus: BarChart;
  readonly emptyStateHeading: Locator;
  readonly clearAllButton: Locator;
  readonly errorAlert: Locator;
  readonly pageNote: Locator;
  readonly pastEndHeading: Locator;
  readonly lastPageButton: Locator;

  constructor(page: Page) {
    super(page, '/reports');
    this.form = page.getByRole('form', { name: 'Report filters' });
    this.applyButton = this.form.getByRole('button', { name: 'Apply filters' });
    this.resetButton = this.form.getByRole('button', { name: 'Reset' });
    this.totals = new KeyFigures(page.getByRole('main'));
    this.table = page.getByRole('table', { name: 'Loans', exact: true });
    this.rangeStatus = page.getByRole('status').filter({ hasText: /^Showing / });
    this.pagination = page.getByRole('navigation', { name: 'Pagination' });
    this.nextPage = this.pagination.getByRole('button', { name: 'Next page' });
    this.previousPage = this.pagination.getByRole('button', { name: 'Previous page' });
    this.pageIndicator = this.pagination.getByText(/^Page \d+ of \d+$/);
    this.principalByStatus = new BarChart(page, 'Principal by status');
    this.emptyStateHeading = page.getByRole('heading', { name: 'No loans match these filters' });
    this.clearAllButton = page.getByRole('button', { name: 'Clear all filters' });
    this.errorAlert = page.getByRole('alert');
    this.pageNote = page.getByRole('note');
    this.pastEndHeading = page.getByRole('heading', { name: /^There is no page / });
    this.lastPageButton = page.getByRole('button', { name: /^Go to page \d+$/ });
  }

  async waitUntilLoaded(): Promise<void> {
    await expect(this.heading).toHaveText('Loan book report');
    await this.waitForResults();
  }

  /** Waits until the list has settled into one of its end states: rows, empty state, a page past the end, or error. */
  async waitForResults(): Promise<void> {
    await this.waitForPlaceholdersToClear();
    await expect(this.table.or(this.emptyStateHeading).or(this.pastEndHeading).or(this.errorAlert)).toBeVisible();
  }

  filter(name: ReportFilter): Locator {
    return this.form.getByLabel(name, { exact: true });
  }

  async setFilter(name: ReportFilter, value: string): Promise<void> {
    if (SELECT_FILTERS.includes(name)) await this.filter(name).selectOption({ label: value });
    else await this.filter(name).fill(value);
  }

  /** The visible text of the option a select filter shows. */
  async selectedOption(name: ReportFilter): Promise<string> {
    return this.filter(name).evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.text ?? '');
  }

  sortButton(column: string): Locator {
    return this.table.getByRole('button', { name: column, exact: true });
  }

  columnHeader(column: string): Locator {
    return this.table.getByRole('columnheader', { name: column, exact: true });
  }

  /** aria-sort of every sortable column, keyed by header text. */
  async sortStates(): Promise<Record<string, string>> {
    return this.table.getByRole('columnheader').evaluateAll((headers) =>
      Object.fromEntries(headers.filter((h) => h.hasAttribute('aria-sort')).map((h) => [h.textContent?.trim() ?? '', h.getAttribute('aria-sort') ?? ''])),
    );
  }

  loanLink(id: string): Locator {
    return this.table.getByRole('link', { name: id, exact: true });
  }

  /** Loan IDs in the order the table shows them (each ID is a link to its detail page). */
  async loanIds(): Promise<string[]> {
    if (!(await this.table.isVisible())) return [];
    return this.table.getByRole('link').allInnerTexts();
  }

  rows(): Promise<TableRow[]> {
    return readTable(this.table);
  }
}
