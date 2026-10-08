/**
 * Self-healing exercise: a "legacy" page object whose locators are broken on purpose and left
 * broken (the brief: "add 3-5 incorrect or brittle locators"). Each one rots in a different way.
 * The healthy equivalents live in loanlens-ui/pages/. Only the @broken-locator scenarios use this.
 *
 * Every locator is declared with its intent and the fingerprint of the element it must find.
 * That is what makes case 4 detectable at all, since its locator still finds an element, and it
 * is the contract every suggested fix is validated against.
 */
import type { Page } from 'playwright';
import { healable, type HealableLocator, type LocatorIntent } from '../healer.js';

/** 1. Renamed test id. Every key figure now shares one "kpi-value" id, so a fix must be scoped to the right figure. */
const TOTAL_LOANS: LocatorIntent = {
  key: 'dashboard.totalLoansValue',
  description: 'The number shown in the "Total loans" key figure on the dashboard',
  expect: { text: /^\d[\d,]*$/, within: { role: 'group', name: 'Total loans' } },
};

/** 2. Changed copy. The navigation link was renamed from "Calculator" to "EMI calculator". */
const CALCULATOR_LINK: LocatorIntent = {
  key: 'nav.calculatorLink',
  description: 'The link in the main navigation that opens the EMI calculator',
  expect: { role: 'link', name: /calculator/i, within: { role: 'navigation', name: 'Primary' } },
};

/** 3. Now ambiguous. A slider was added beside the number box with the same label, so the label matches two controls. */
const AMOUNT_SLIDER: LocatorIntent = {
  key: 'calculator.loanAmountSlider',
  description: 'The range slider that sets the loan amount in the EMI calculator',
  expect: { role: 'slider', name: 'Loan amount' },
};

/** 4. Positional. "The first table on the page" stopped being true when the donut chart gained a values table above it. */
const RECENT_TABLE: LocatorIntent = {
  key: 'dashboard.recentDisbursementsTable',
  description: 'The table of recent disbursements on the dashboard, one row per loan',
  expect: { role: 'table', name: 'Recent disbursements' },
};

/** 5. Removed feature. There is no export button any more; a correct healer must refuse rather than guess. */
const EXPORT_CSV: LocatorIntent = {
  key: 'dashboard.exportCsvButton',
  description: 'The button that downloads the loan book as a CSV file',
  expect: { role: 'button', name: /export|csv|download/i },
};

export class LegacyLocators {
  readonly totalLoansValue: HealableLocator;
  readonly calculatorLink: HealableLocator;
  readonly loanAmountSlider: HealableLocator;
  readonly recentDisbursementsTable: HealableLocator;
  readonly exportCsvButton: HealableLocator;

  constructor(page: Page, scenario: HealableLocator['scenario']) {
    this.totalLoansValue = healable(page, TOTAL_LOANS, (p) => p.getByTestId('kpi-total-loans'), scenario);
    this.calculatorLink = healable(page, CALCULATOR_LINK, (p) => p.getByRole('link', { name: 'Calculator', exact: true }), scenario);
    this.loanAmountSlider = healable(page, AMOUNT_SLIDER, (p) => p.getByLabel('Loan amount'), scenario);
    this.recentDisbursementsTable = healable(page, RECENT_TABLE, (p) => p.locator('table').first(), scenario);
    this.exportCsvButton = healable(page, EXPORT_CSV, (p) => p.getByRole('button', { name: 'Export CSV' }), scenario);
  }
}
