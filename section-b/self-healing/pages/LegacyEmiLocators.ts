/**
 * Self-healing exercise, Section B: a "legacy" page object for emicalculator.net whose
 * locators are broken on purpose and left broken (brief: "add 3-5 incorrect or brittle
 * locators"). A third-party page cannot be changed to break a locator, so each is written wrong
 * against the live page, in a different way locators rot.
 * The healthy equivalents live in section-b/emicalculator/pages/; these are only used by
 * section-b/self-healing/features/broken-locators.feature (@broken-locator), which the
 * regular suites exclude.
 *
 * Every locator is declared with its intent and the fingerprint of the element it must find.
 * That declaration is what makes a failure detectable even when the locator still resolves
 * (case 4), and it is the contract any suggested fix is validated against. See
 * docs/SELF_HEALING.md.
 */
import type { Page } from 'playwright';
import { healable } from '../../../self-healing/runtime.js';
import type { LocatorIntent } from '../../../self-healing/types.js';

/** 1. Wrong id. Written as "#loan-term"; the box's id is "#loanterm". */
const TENURE_BOX: LocatorIntent = {
  key: 'emicalculator.loanTenureBox',
  description: 'The number box where the loan tenure is typed, next to the Yr/Mo toggle',
  expect: { role: 'textbox', name: 'Loan Tenure' },
};

/** 2. Wrong copy. Written as "Personal Loans"; the tab reads "Personal Loan". */
const PERSONAL_LOAN_TAB: LocatorIntent = {
  key: 'emicalculator.personalLoanTab',
  description: 'The tab above the calculator that switches it to personal loans',
  expect: { role: 'link', name: 'Personal Loan' },
};

/** 3. Ambiguous. /loan/i matches the amount box, and "Loan Tenure" too. */
const AMOUNT_BOX: LocatorIntent = {
  key: 'emicalculator.homeLoanAmountBox',
  description: 'The number box where the home loan amount in rupees is typed',
  expect: { role: 'textbox', name: 'Home Loan Amount' },
};

/** 4. Positional. "The last text box" assumes the rate box is the last one on the page; it finds the comment form's Name box. */
const RATE_BOX: LocatorIntent = {
  key: 'emicalculator.interestRateBox',
  description: 'The number box where the annual interest rate in percent is typed',
  expect: { role: 'textbox', name: 'Interest Rate' },
};

/** 5. A feature the page does not have. It offers PDF, Excel and Share, but no e-mail button; a correct healer must refuse rather than guess. */
const EMAIL_SCHEDULE: LocatorIntent = {
  key: 'emicalculator.emailScheduleButton',
  description: 'The button that e-mails the repayment schedule to the user',
  expect: { role: 'button', name: /e-?mail/i },
};

export class LegacyEmiLocators {
  readonly loanTenureBox;
  readonly personalLoanTab;
  readonly homeLoanAmountBox;
  readonly interestRateBox;
  readonly emailScheduleButton;

  constructor(page: Page) {
    this.loanTenureBox = healable(page, TENURE_BOX, (p) => p.locator('#loan-term'));
    this.personalLoanTab = healable(page, PERSONAL_LOAN_TAB, (p) => p.getByRole('link', { name: 'Personal Loans', exact: true }));
    this.homeLoanAmountBox = healable(page, AMOUNT_BOX, (p) => p.getByRole('textbox', { name: /loan/i }));
    this.interestRateBox = healable(page, RATE_BOX, (p) => p.locator('input[type="text"]').last());
    this.emailScheduleButton = healable(page, EMAIL_SCHEDULE, (p) => p.getByRole('button', { name: 'Email schedule' }));
  }
}
