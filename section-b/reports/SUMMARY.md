# Section B test results

Run 2026-10-07T11:21:06.439Z · `npm run test:section-b` · node v26.7.0 · TEST_ENV=local · heal provider: auto

> Some HTML reports below show red scenarios. Those are expected failures: each one is a documented defect in a third-party site, or a locator broken on purpose for the self-healing exercise. The **Failed (unexpected)** column is the verdict.

| Suite | Brief | Scenarios | Passed | Failed (expected) | Failed (unexpected) | Gherkin steps | Wall time | Reports |
|---|---|---|---|---|---|---|---|---|
| loanlens-api | B1/B2 | 106 | 106 | 0 | 0 | 583 | 3 s | [html](loanlens-api/cucumber-report.html) · [log](loanlens-api/console.log) |
| emicalculator | B3 | 38 | 23 | 15 | 0 | 239 | 49 s | [html](emicalculator/cucumber-report.html) · [log](emicalculator/console.log) |
| sql | A4/B4 | 6 | 6 | 0 | 0 | 31 | 3 s | [html](sql/cucumber-report.html) · [log](sql/console.log) |
| self-healing | AI exercise | 5 | 0 | 5 | 0 | 13 | 17 s | [html](self-healing/cucumber-report.html) · [log](self-healing/console.log) |
| self-healing-healed | AI exercise | 5 | 4 | 1 | 0 | 13 | 37 s | [html](self-healing-healed/cucumber-report.html) · [log](self-healing-healed/console.log) |

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

- expected: Renamed test id - the Total loans figure shows the size of the loan book (`self-healing/features/broken-locators.feature:16`)
  - LocatorHealingError: Locator "dashboard.totalLoansValue" failed: page.getByTestId('kpi-total-loans') → No element matched within 5 s.
- expected: Changed button text - applying a status filter narrows the report (`self-healing/features/broken-locators.feature:20`)
  - LocatorHealingError: Locator "reports.applyFiltersButton" failed: page.getByRole('button', { name: 'Apply filter', exact: true }) → No element matched within 5 s.
- expected: Ambiguous label - the loan amount slider updates the number box (`self-healing/features/broken-locators.feature:25`)
  - LocatorHealingError: Locator "calculator.loanAmountSlider" failed: page.getByLabel('Loan amount') → 2 elements matched; an action on it would violate strict mode.
- expected: Positional locator - the recent disbursements table starts with the newest loan (`self-healing/features/broken-locators.feature:30`)
  - LocatorHealingError: Locator "dashboard.recentDisbursementsTable" failed: page.locator('table').first() → Resolved, but element does not have role table named Recent disbursements.
- expected: Removed feature - exporting the report as CSV (`self-healing/features/broken-locators.feature:35`)
  - LocatorHealingError: Locator "reports.exportCsvButton" failed: page.getByRole('button', { name: 'Export CSV' }) → No element matched within 5 s.

### self-healing-healed

- expected: Removed feature - exporting the report as CSV (`self-healing/features/broken-locators.feature:35`)
  - LocatorHealingError: Locator "reports.exportCsvButton" failed: page.getByRole('button', { name: 'Export CSV' }) → No element matched within 5 s.

## Tagged as expected to fail, but passed

A row here means the documented defect may have been fixed upstream: check it by hand, then drop the tag and move the row to the passing set.

None.
