# Section B test results

Run 2026-10-07T12:23:57.497Z · `npm run test:section-b` · node v26.7.0 · TEST_ENV=local · heal provider: auto

> Some HTML reports below show red scenarios. Those are expected failures: each one is a documented defect in a third-party site, or a locator broken on purpose for the self-healing exercise. The **Failed (unexpected)** column is the verdict.

| Suite | Brief | Scenarios | Passed | Failed (expected) | Failed (unexpected) | Gherkin steps | Wall time | Reports |
|---|---|---|---|---|---|---|---|---|
| loanlens-api | B1/B2 | 106 | 106 | 0 | 0 | 583 | 3 s | [html](loanlens-api/cucumber-report.html) · [log](loanlens-api/console.log) |
| emicalculator | B3 | 38 | 23 | 15 | 0 | 239 | 49 s | [html](emicalculator/cucumber-report.html) · [log](emicalculator/console.log) |
| sql | A4/B4 | 6 | 6 | 0 | 0 | 31 | 3 s | [html](sql/cucumber-report.html) · [log](sql/console.log) |
| self-healing | AI exercise | 5 | 0 | 5 | 0 | 15 | 22 s | [html](self-healing/cucumber-report.html) · [log](self-healing/console.log) |
| self-healing-healed | AI exercise | 5 | 4 | 1 | 0 | 15 | 49 s | [html](self-healing-healed/cucumber-report.html) · [log](self-healing-healed/console.log) |

**Unexpected failures: 0.** Expected failures are documented defects of emicalculator.net's input handling (`@known-defect`, see [emicalculator/FINDINGS.md](../emicalculator/FINDINGS.md)), and the deliberately broken locators run with healing off (`@broken-locator`, see [docs/SELF_HEALING.md](../../docs/SELF_HEALING.md)).

## Failed scenarios

### emicalculator

- expected: An invalid loan amount is refused, not reinterpreted: negative amount, leaving the box (`section-b/emicalculator/features/input-validation.feature:42`)
  - Error: I typed "-2383434" into the Loan Amount box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid loan amount is refused, not reinterpreted: negative amount, pressing Enter (`section-b/emicalculator/features/input-validation.feature:43`)
  - Error: I typed "-2383434" into the Loan Amount box and pressed Enter. The calculator did not refuse it and showed no message.
- expected: An invalid loan amount is refused, not reinterpreted: zero (`section-b/emicalculator/features/input-validation.feature:48`)
  - Error: I typed "0" into the Loan Amount box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid loan amount is refused, not reinterpreted: letters only (`section-b/emicalculator/features/input-validation.feature:49`)
  - Error: I typed "abc" into the Loan Amount box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid loan amount is refused, not reinterpreted: letters between digits (`section-b/emicalculator/features/input-validation.feature:54`)
  - Error: I typed "12abc34" into the Loan Amount box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid loan amount is refused, not reinterpreted: two decimal points (`section-b/emicalculator/features/input-validation.feature:59`)
  - Error: I typed "25.00.000" into the Loan Amount box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid loan amount is refused, not reinterpreted: a 26-digit amount (`section-b/emicalculator/features/input-validation.feature:60`)
  - Error: I typed "99999999999999999999999999" into the Loan Amount box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: A valid interest rate is used as typed: zero interest (`section-b/emicalculator/features/input-validation.feature:77`)
  - Error: expect(locator).toHaveValue(expected) failed
- expected: An invalid interest rate is refused, not reinterpreted: negative rate (`section-b/emicalculator/features/input-validation.feature:87`)
  - Error: I typed "-8.5" into the Interest Rate box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid interest rate is refused, not reinterpreted: letters (`section-b/emicalculator/features/input-validation.feature:88`)
  - Error: I typed "abc" into the Interest Rate box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid interest rate is refused, not reinterpreted: decimal comma (`section-b/emicalculator/features/input-validation.feature:89`)
  - Error: I typed "8,5" into the Interest Rate box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid tenure in years is refused, not reinterpreted: negative tenure (`section-b/emicalculator/features/input-validation.feature:121`)
  - Error: I typed "-2" into the Loan Tenure box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid tenure in years is refused, not reinterpreted: zero (`section-b/emicalculator/features/input-validation.feature:122`)
  - Error: I typed "0" into the Loan Tenure box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid tenure in years is refused, not reinterpreted: letters (`section-b/emicalculator/features/input-validation.feature:123`)
  - Error: I typed "abc" into the Loan Tenure box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid tenure in months is refused, not reinterpreted: half a month (`section-b/emicalculator/features/input-validation.feature:134`)
  - Error: I typed "2.5" into the Loan Tenure box and pressed Tab. The calculator did not refuse it and showed no message.

### self-healing

- expected: Wrong id - the tenure box sets the loan tenure (`section-b/self-healing/features/broken-locators.feature:20`)
  - LocatorHealingError: Locator "emicalculator.loanTenureBox" failed: page.locator('#loan-term') → No element matched within 5 s.
- expected: Wrong link text - the Personal Loan tab switches the calculator (`section-b/self-healing/features/broken-locators.feature:24`)
  - LocatorHealingError: Locator "emicalculator.personalLoanTab" failed: page.getByRole('link', { name: 'Personal Loans', exact: true }) → No element matched within 5 s.
- expected: Ambiguous name - the amount box sets the principal (`section-b/self-healing/features/broken-locators.feature:28`)
  - LocatorHealingError: Locator "emicalculator.homeLoanAmountBox" failed: page.getByRole('textbox', { name: /loan/i }) → 2 elements matched; an action on it would violate strict mode.
- expected: Positional locator - the interest rate box sets the rate (`section-b/self-healing/features/broken-locators.feature:32`)
  - LocatorHealingError: Locator "emicalculator.interestRateBox" failed: page.locator('input[type="text"]').last() → Resolved, but element does not have role textbox named Interest Rate.
- expected: Missing feature - e-mailing the repayment schedule (`section-b/self-healing/features/broken-locators.feature:37`)
  - LocatorHealingError: Locator "emicalculator.emailScheduleButton" failed: page.getByRole('button', { name: 'Email schedule' }) → No element matched within 5 s.

### self-healing-healed

- expected: Missing feature - e-mailing the repayment schedule (`section-b/self-healing/features/broken-locators.feature:37`)
  - LocatorHealingError: Locator "emicalculator.emailScheduleButton" failed: page.getByRole('button', { name: 'Email schedule' }) → No element matched within 5 s.

## Tagged as expected to fail, but passed

A row here means the documented defect may have been fixed upstream: check it by hand, then drop the tag and move the row to the passing set.

None.
