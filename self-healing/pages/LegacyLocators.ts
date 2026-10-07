/**
 * Self-healing exercise: a "legacy" page object whose locators are broken on
 * purpose and left broken (brief: "add 3-5 incorrect or brittle locators").
 * Each reproduces a different way locators rot in a real suite. The healthy
 * equivalents live in section-a/loanlens-ui/pages/; these are only used by
 * self-healing/features/broken-locators.feature (@broken-locator), which
 * the regular suites exclude.
 *
 * Every locator is declared with its intent and the fingerprint of the element
 * it must find. That declaration is what makes a failure detectable even when
 * the locator still resolves (case 4), and it is the contract any suggested fix
 * is validated against. See docs/SELF_HEALING.md.
 */
import type { Page } from 'playwright';
import { healable } from '../runtime.js';
import type { LocatorIntent } from '../types.js';

/** 1. Renamed test id. The per-figure ids were replaced by one shared "kpi-value" id, so the fix needs scoping. */
const TOTAL_LOANS: LocatorIntent = {
  key: 'dashboard.totalLoansValue',
  description: 'The number shown in the "Total loans" key figure on the dashboard',
  expect: { text: /^\d[\d,]*$/, within: { role: 'group', name: 'Total loans' } },
};

/** 2. Changed copy. The button text went from "Apply filter" to "Apply filters". */
const APPLY_FILTERS: LocatorIntent = {
  key: 'reports.applyFiltersButton',
  description: 'The button that applies the report filters form on the loan book report',
  expect: { role: 'button', name: /^apply/i },
};

/** 3. Now ambiguous. A slider was added next to the number box with the same label, so the label matches two controls. */
const AMOUNT_SLIDER: LocatorIntent = {
  key: 'calculator.loanAmountSlider',
  description: 'The range slider that sets the loan amount in the EMI calculator',
  expect: { role: 'slider', name: 'Loan amount' },
};

/** 4. Positional. "The first table on the page" was true until the donut chart gained an accessible values table above it. */
const RECENT_TABLE: LocatorIntent = {
  key: 'dashboard.recentDisbursementsTable',
  description: 'The table of recent disbursements on the dashboard, one row per loan',
  expect: { role: 'table', name: 'Recent disbursements' },
};

/** 5. Removed feature. There is no export button any more; a correct healer must refuse rather than guess. */
const EXPORT_CSV: LocatorIntent = {
  key: 'reports.exportCsvButton',
  description: 'The button that downloads the filtered loans as a CSV file',
  expect: { role: 'button', name: /export|csv|download/i },
};

export class LegacyLocators {
  readonly totalLoansValue;
  readonly applyFiltersButton;
  readonly loanAmountSlider;
  readonly recentDisbursementsTable;
  readonly exportCsvButton;

  constructor(private readonly page: Page) {
    this.totalLoansValue = healable(page, TOTAL_LOANS, (p) => p.getByTestId('kpi-total-loans'));
    this.applyFiltersButton = healable(page, APPLY_FILTERS, (p) => p.getByRole('button', { name: 'Apply filter', exact: true }));
    this.loanAmountSlider = healable(page, AMOUNT_SLIDER, (p) => p.getByLabel('Loan amount'));
    this.recentDisbursementsTable = healable(page, RECENT_TABLE, (p) => p.locator('table').first());
    this.exportCsvButton = healable(page, EXPORT_CSV, (p) => p.getByRole('button', { name: 'Export CSV' }));
  }

  /** A healthy locator, for contrast: role + accessible name, scoped to its form. */
  statusFilter() {
    return this.page.getByRole('form', { name: 'Report filters' }).getByLabel('Status', { exact: true });
  }
}
