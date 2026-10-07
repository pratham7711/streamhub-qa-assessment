# Test results

Run 2026-10-06T22:08:03.320Z · node v26.7.0 · TEST_ENV=local · heal provider: auto

> Some HTML reports below show red scenarios. Those are expected failures: each one is a documented defect in a third-party site, or a locator broken on purpose for the self-healing demo. The **Failed (unexpected)** column is the verdict.

| Suite | Scenarios | Passed | Failed (expected) | Failed (unexpected) | Gherkin steps | Wall time | Reports |
|---|---|---|---|---|---|---|---|
| loanlens-api | 106 | 106 | 0 | 0 | 583 | 3 s | [html](loanlens-api/cucumber-report.html) · [log](loanlens-api/console.log) |
| loanlens-ui | 56 | 56 | 0 | 0 | 335 | 17 s | [html](loanlens-ui/cucumber-report.html) · [log](loanlens-ui/console.log) |
| sql | 6 | 6 | 0 | 0 | 31 | 3 s | [html](sql/cucumber-report.html) · [log](sql/console.log) |
| jsonplaceholder | 36 | 16 | 20 | 0 | 147 | 11 s | [html](jsonplaceholder/cucumber-report.html) · [log](jsonplaceholder/console.log) |
| emicalculator | 38 | 23 | 15 | 0 | 239 | 51 s | [html](emicalculator/cucumber-report.html) · [log](emicalculator/console.log) |
| self-healing | 5 | 0 | 5 | 0 | 13 | 18 s | [html](self-healing/cucumber-report.html) · [log](self-healing/console.log) |
| self-healing-healed | 5 | 4 | 1 | 0 | 13 | 39 s | [html](self-healing-healed/cucumber-report.html) · [log](self-healing-healed/console.log) |

**Unexpected failures: 0.** Expected failures are documented defects of the public JSONPlaceholder API and of emicalculator.net's input handling (`@known-defect`, see [docs/jsonplaceholder-findings.md](../docs/jsonplaceholder-findings.md) and [docs/emicalculator-findings.md](../docs/emicalculator-findings.md)), and the deliberately broken locators run with healing off (`@broken-locator`, see [docs/SELF_HEALING.md](../docs/SELF_HEALING.md)).

## Failed scenarios

### jsonplaceholder

- expected: a title larger than 10 MiB does not cause a server error (`tests/features/jsonplaceholder/create-post-robustness.feature:46`)
  - Error: Expected a non-5xx status, got a server-side failure.
- expected: malformed JSON does not cause a server error (`tests/features/jsonplaceholder/create-post-robustness.feature:47`)
  - Error: Expected a non-5xx status, got a server-side failure.
- expected: a 256-character title is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:41`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a title larger than 10 MiB is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:42`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 500 Internal Server Error, a server-side failure.
- expected: a title with a NUL byte is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:46`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a title with an unpaired surrogate is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:47`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a title with invalid UTF-8 bytes is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:48`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a title with bidirectional overrides is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:49`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post without userId is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:53`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post without title is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:54`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post without body is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:55`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post with null userId is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:56`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post with an empty title is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:57`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post with a text userId is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:61`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post with a negative userId is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:62`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post with an unknown userId is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:63`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post with a numeric title is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:64`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: malformed JSON is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:65`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 500 Internal Server Error, a server-side failure.
- expected: a JSON array instead of an object is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:66`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a JSON body sent as text/plain is rejected (`tests/features/jsonplaceholder/create-post-validation.feature:67`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.

### emicalculator

- expected: An invalid loan amount is refused, not reinterpreted: negative amount, leaving the box (`tests/features/emicalculator/input-validation.feature:42`)
  - Error: I typed "-2383434" into the Loan Amount box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid loan amount is refused, not reinterpreted: negative amount, pressing Enter (`tests/features/emicalculator/input-validation.feature:43`)
  - Error: I typed "-2383434" into the Loan Amount box and pressed Enter. The calculator did not refuse it and showed no message.
- expected: An invalid loan amount is refused, not reinterpreted: zero (`tests/features/emicalculator/input-validation.feature:48`)
  - Error: I typed "0" into the Loan Amount box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid loan amount is refused, not reinterpreted: letters only (`tests/features/emicalculator/input-validation.feature:49`)
  - Error: I typed "abc" into the Loan Amount box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid loan amount is refused, not reinterpreted: letters between digits (`tests/features/emicalculator/input-validation.feature:54`)
  - Error: I typed "12abc34" into the Loan Amount box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid loan amount is refused, not reinterpreted: two decimal points (`tests/features/emicalculator/input-validation.feature:59`)
  - Error: I typed "25.00.000" into the Loan Amount box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid loan amount is refused, not reinterpreted: a 26-digit amount (`tests/features/emicalculator/input-validation.feature:60`)
  - Error: I typed "99999999999999999999999999" into the Loan Amount box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: A valid interest rate is used as typed: zero interest (`tests/features/emicalculator/input-validation.feature:77`)
  - Error: expect(locator).toHaveValue(expected) failed
- expected: An invalid interest rate is refused, not reinterpreted: negative rate (`tests/features/emicalculator/input-validation.feature:87`)
  - Error: I typed "-8.5" into the Interest Rate box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid interest rate is refused, not reinterpreted: letters (`tests/features/emicalculator/input-validation.feature:88`)
  - Error: I typed "abc" into the Interest Rate box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid interest rate is refused, not reinterpreted: decimal comma (`tests/features/emicalculator/input-validation.feature:89`)
  - Error: I typed "8,5" into the Interest Rate box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid tenure in years is refused, not reinterpreted: negative tenure (`tests/features/emicalculator/input-validation.feature:121`)
  - Error: I typed "-2" into the Loan Tenure box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid tenure in years is refused, not reinterpreted: zero (`tests/features/emicalculator/input-validation.feature:122`)
  - Error: I typed "0" into the Loan Tenure box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid tenure in years is refused, not reinterpreted: letters (`tests/features/emicalculator/input-validation.feature:123`)
  - Error: I typed "abc" into the Loan Tenure box and pressed Tab. The calculator did not refuse it and showed no message.
- expected: An invalid tenure in months is refused, not reinterpreted: half a month (`tests/features/emicalculator/input-validation.feature:134`)
  - Error: I typed "2.5" into the Loan Tenure box and pressed Tab. The calculator did not refuse it and showed no message.

### self-healing

- expected: Renamed test id - the Total loans figure shows the size of the loan book (`tests/features/self-healing/broken-locators.feature:16`)
  - LocatorHealingError: Locator "dashboard.totalLoansValue" failed: page.getByTestId('kpi-total-loans') → No element matched within 5 s.
- expected: Changed button text - applying a status filter narrows the report (`tests/features/self-healing/broken-locators.feature:20`)
  - LocatorHealingError: Locator "reports.applyFiltersButton" failed: page.getByRole('button', { name: 'Apply filter', exact: true }) → No element matched within 5 s.
- expected: Ambiguous label - the loan amount slider updates the number box (`tests/features/self-healing/broken-locators.feature:25`)
  - LocatorHealingError: Locator "calculator.loanAmountSlider" failed: page.getByLabel('Loan amount') → 2 elements matched; an action on it would violate strict mode.
- expected: Positional locator - the recent disbursements table starts with the newest loan (`tests/features/self-healing/broken-locators.feature:30`)
  - LocatorHealingError: Locator "dashboard.recentDisbursementsTable" failed: page.locator('table').first() → Resolved, but element does not have role table named Recent disbursements.
- expected: Removed feature - exporting the report as CSV (`tests/features/self-healing/broken-locators.feature:35`)
  - LocatorHealingError: Locator "reports.exportCsvButton" failed: page.getByRole('button', { name: 'Export CSV' }) → No element matched within 5 s.

### self-healing-healed

- expected: Removed feature - exporting the report as CSV (`tests/features/self-healing/broken-locators.feature:35`)
  - LocatorHealingError: Locator "reports.exportCsvButton" failed: page.getByRole('button', { name: 'Export CSV' }) → No element matched within 5 s.

## Tagged as expected to fail, but passed

A row here means the documented defect may have been fixed upstream: check it by hand, then drop the tag and move the row to the passing set.

None.
