# Section A test results

Run 2026-10-07T12:26:28.471Z · `npm run test:section-a` · node v26.7.0 · TEST_ENV=local · heal provider: auto

> Some HTML reports below show red scenarios. Those are expected failures: each one is a documented defect in a third-party site, or a locator broken on purpose for the self-healing exercise. The **Failed (unexpected)** column is the verdict.

| Suite | Brief | Scenarios | Passed | Failed (expected) | Failed (unexpected) | Gherkin steps | Wall time | Reports |
|---|---|---|---|---|---|---|---|---|
| loanlens-ui | A1/A2 | 57 | 57 | 0 | 0 | 346 | 15 s | [html](loanlens-ui/cucumber-report.html) · [log](loanlens-ui/console.log) |
| jsonplaceholder | A3 | 36 | 16 | 20 | 0 | 147 | 11 s | [html](jsonplaceholder/cucumber-report.html) · [log](jsonplaceholder/console.log) |
| sql | A4/B4 | 6 | 6 | 0 | 0 | 31 | 3 s | [html](sql/cucumber-report.html) · [log](sql/console.log) |
| self-healing | AI exercise | 5 | 0 | 5 | 0 | 13 | 17 s | [html](self-healing/cucumber-report.html) · [log](self-healing/console.log) |
| self-healing-healed | AI exercise | 5 | 4 | 1 | 0 | 13 | 49 s | [html](self-healing-healed/cucumber-report.html) · [log](self-healing-healed/console.log) |

**Unexpected failures: 0.** Expected failures are documented defects of the public JSONPlaceholder API (`@known-defect`, see [jsonplaceholder/FINDINGS.md](../jsonplaceholder/FINDINGS.md)), and the deliberately broken locators run with healing off (`@broken-locator`, see [docs/SELF_HEALING.md](../../docs/SELF_HEALING.md)).

## Failed scenarios

### jsonplaceholder

- expected: a title larger than 10 MiB does not cause a server error (`section-a/jsonplaceholder/features/create-post-robustness.feature:46`)
  - Error: Expected a non-5xx status, got a server-side failure.
- expected: malformed JSON does not cause a server error (`section-a/jsonplaceholder/features/create-post-robustness.feature:47`)
  - Error: Expected a non-5xx status, got a server-side failure.
- expected: a 256-character title is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:41`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a title larger than 10 MiB is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:42`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 500 Internal Server Error, a server-side failure.
- expected: a title with a NUL byte is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:46`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a title with an unpaired surrogate is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:47`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a title with invalid UTF-8 bytes is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:48`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a title with bidirectional overrides is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:49`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post without userId is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:53`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post without title is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:54`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post without body is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:55`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post with null userId is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:56`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post with an empty title is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:57`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post with a text userId is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:61`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post with a negative userId is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:62`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post with an unknown userId is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:63`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a post with a numeric title is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:64`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: malformed JSON is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:65`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 500 Internal Server Error, a server-side failure.
- expected: a JSON array instead of an object is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:66`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.
- expected: a JSON body sent as text/plain is rejected (`section-a/jsonplaceholder/features/create-post-validation.feature:67`)
  - Error: Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered 201 Created and accepted the invalid payload.

### self-healing

- expected: Renamed test id - the Total loans figure shows the size of the loan book (`section-a/self-healing/features/broken-locators.feature:16`)
  - LocatorHealingError: Locator "dashboard.totalLoansValue" failed: page.getByTestId('kpi-total-loans') → No element matched within 5 s.
- expected: Changed button text - applying a status filter narrows the report (`section-a/self-healing/features/broken-locators.feature:20`)
  - LocatorHealingError: Locator "reports.applyFiltersButton" failed: page.getByRole('button', { name: 'Apply filter', exact: true }) → No element matched within 5 s.
- expected: Ambiguous label - the loan amount slider updates the number box (`section-a/self-healing/features/broken-locators.feature:25`)
  - LocatorHealingError: Locator "calculator.loanAmountSlider" failed: page.getByLabel('Loan amount') → 2 elements matched; an action on it would violate strict mode.
- expected: Positional locator - the recent disbursements table starts with the newest loan (`section-a/self-healing/features/broken-locators.feature:30`)
  - LocatorHealingError: Locator "dashboard.recentDisbursementsTable" failed: page.locator('table').first() → Resolved, but element does not have role table named Recent disbursements.
- expected: Removed feature - exporting the report as CSV (`section-a/self-healing/features/broken-locators.feature:35`)
  - LocatorHealingError: Locator "reports.exportCsvButton" failed: page.getByRole('button', { name: 'Export CSV' }) → No element matched within 5 s.

### self-healing-healed

- expected: Removed feature - exporting the report as CSV (`section-a/self-healing/features/broken-locators.feature:35`)
  - LocatorHealingError: Locator "reports.exportCsvButton" failed: page.getByRole('button', { name: 'Export CSV' }) → No element matched within 5 s.

## Tagged as expected to fail, but passed

A row here means the documented defect may have been fixed upstream: check it by hand, then drop the tag and move the row to the passing set.

None.
