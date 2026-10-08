# Section A test results

Run 2026-10-08T03:01:26.930Z · `npm test` · node v26.7.0 · TEST_ENV=local

Red scenarios in the HTML reports are expected when they are tagged and fail for the tagged reason: a documented defect of the public JSONPlaceholder API (`@known-defect`, [FINDINGS.md](../jsonplaceholder/FINDINGS.md)) or a locator broken on purpose for the self-healing exercise (`@broken-locator`, [SELF_HEALING.md](../docs/SELF_HEALING.md)). Any other failure, including a timeout under one of those tags, is unexpected. The **Failed (unexpected)** column is the verdict.

| Suite | Brief | Scenarios | Passed | Failed (expected) | Failed (unexpected) | Time · reports |
|---|---|---|---|---|---|---|
| loanlens-ui | A1/A2 | 10 | 10 | 0 | 0 | 2 s · [html](loanlens-ui/cucumber-report.html) · [log](loanlens-ui/console.log) |
| jsonplaceholder | A3 | 10 | 1 | 9 | 0 | 10 s · [html](jsonplaceholder/cucumber-report.html) · [log](jsonplaceholder/console.log) |
| self-healing | Self-healing | 5 | 0 | 5 | 0 | 16 s · [html](self-healing/cucumber-report.html) · [log](self-healing/console.log) |

**Unexpected failures: 0.**

## Failed scenarios

### jsonplaceholder

- expected: a 10,000-character title is rejected without a server error (`jsonplaceholder/features/create-post.feature:20`)
  - Error: Expected a 4xx rejection (such as 400, 413 or 422), but the API answered 201 Created, accepting the invalid payload.
- expected: a title larger than 10 MiB is rejected without a server error (`jsonplaceholder/features/create-post.feature:21`)
  - Error: Expected a 4xx rejection (such as 400, 413 or 422), but the API answered 500 Internal Server Error, a server-side failure.
- expected: a title with a NUL byte is rejected without a server error (`jsonplaceholder/features/create-post.feature:25`)
  - Error: Expected a 4xx rejection (such as 400, 413 or 422), but the API answered 201 Created, accepting the invalid payload.
- expected: a title with invalid UTF-8 bytes is rejected without a server error (`jsonplaceholder/features/create-post.feature:26`)
  - Error: Expected a 4xx rejection (such as 400, 413 or 422), but the API answered 201 Created, accepting the invalid payload.
- expected: a title with HTML script markup is rejected without a server error (`jsonplaceholder/features/create-post.feature:27`)
  - Error: Expected a 4xx rejection (such as 400, 413 or 422), but the API answered 201 Created, accepting the invalid payload.
- expected: a post without userId is rejected without a server error (`jsonplaceholder/features/create-post.feature:31`)
  - Error: Expected a 4xx rejection (such as 400, 413 or 422), but the API answered 201 Created, accepting the invalid payload.
- expected: a post without title is rejected without a server error (`jsonplaceholder/features/create-post.feature:32`)
  - Error: Expected a 4xx rejection (such as 400, 413 or 422), but the API answered 201 Created, accepting the invalid payload.
- expected: an empty object is rejected without a server error (`jsonplaceholder/features/create-post.feature:33`)
  - Error: Expected a 4xx rejection (such as 400, 413 or 422), but the API answered 201 Created, accepting the invalid payload.
- expected: a userId that is not a number is rejected without a server error (`jsonplaceholder/features/create-post.feature:37`)
  - Error: Expected a 4xx rejection (such as 400, 413 or 422), but the API answered 201 Created, accepting the invalid payload.

### self-healing

- expected: Renamed test id - the Total loans figure shows the size of the loan book (`self-healing/features/broken-locators.feature:13`)
  - Error: Locator "dashboard.totalLoansValue" failed: page.getByTestId('kpi-total-loans'): no element matched within 5 s.
- expected: Changed link text - the main navigation opens the EMI calculator (`self-healing/features/broken-locators.feature:17`)
  - Error: Locator "nav.calculatorLink" failed: page.getByRole('link', { name: 'Calculator', exact: true }): no element matched within 5 s.
- expected: Ambiguous label - the loan amount slider updates the number box (`self-healing/features/broken-locators.feature:22`)
  - Error: Locator "calculator.loanAmountSlider" failed: page.getByLabel('Loan amount'): 2 elements matched, so any action on it breaks strict mode.
- expected: Positional locator - the recent disbursements table starts with the newest loan (`self-healing/features/broken-locators.feature:27`)
  - Error: Locator "dashboard.recentDisbursementsTable" failed: page.locator('table').first(): it found one element, but the wrong one: is not a table named Recent disbursements.
- expected: Removed feature - exporting the loan book as CSV (`self-healing/features/broken-locators.feature:32`)
  - Error: Locator "dashboard.exportCsvButton" failed: page.getByRole('button', { name: 'Export CSV' }): no element matched within 5 s.

## Tagged as expected to fail, but passed

A row here means a documented defect may have been fixed upstream.

None.
