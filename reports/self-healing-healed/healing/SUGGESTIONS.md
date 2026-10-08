# Self-healing suggestions

4 of 5 broken locators have a validated replacement; 4 of those scenarios then passed on it. Claude cost $0.011 in total.
Nothing here has been applied to the source.

| Locator | Why it failed | Suggested replacement | Scenario on the fix |
|---|---|---|---|
| `dashboard.totalLoansValue` | no element matched within 5 s | `page.getByRole('group', { name: 'Total loans' }).getByTestId('kpi-value')` | passed |
| `nav.calculatorLink` | no element matched within 5 s | `page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'EMI calculator', exact: true })` | passed |
| `calculator.loanAmountSlider` | 2 elements matched, so any action on it breaks strict mode | `page.getByRole('slider', { name: 'Loan amount', exact: true })` | passed |
| `dashboard.recentDisbursementsTable` | it found one element, but the wrong one: is not a table named Recent disbursements | `page.getByRole('table', { name: 'Recent disbursements', exact: true })` | passed |
| `dashboard.exportCsvButton` | no element matched within 5 s | **none** | not run |

## `dashboard.totalLoansValue`

- **Scenario:** Renamed test id - the Total loans figure shows the size of the loan book
- **Failed locator:** `page.getByTestId('kpi-total-loans')`
- **Claude:** 4.3 s, $0.002 · prompt in `prompts/dashboard.totalLoansValue.txt`
- **Accepted:** `page.getByRole('group', { name: 'Total loans' }).getByTestId('kpi-value')` (✔ unique · ✔ visible · ✔ container · ✔ text). The test id 'kpi-value' exists inside the 'Total loans' group and holds the number 120, matching the fingerprint.
- **Rejected:** none

## `nav.calculatorLink`

- **Scenario:** Changed link text - the main navigation opens the EMI calculator
- **Failed locator:** `page.getByRole('link', { name: 'Calculator', exact: true })`
- **Claude:** 5.0 s, $0.003 · prompt in `prompts/nav.calculatorLink.txt`
- **Accepted:** `page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'EMI calculator', exact: true })` (✔ unique · ✔ visible · ✔ role and name · ✔ container). The link is now named "EMI calculator" and sits inside the Primary navigation, matching the expected fingerprint.
- **Rejected:** none

## `calculator.loanAmountSlider`

- **Scenario:** Ambiguous label - the loan amount slider updates the number box
- **Failed locator:** `page.getByLabel('Loan amount')`
- **Claude:** 3.5 s, $0.002 · prompt in `prompts/calculator.loanAmountSlider.txt`
- **Accepted:** `page.getByRole('slider', { name: 'Loan amount', exact: true })` (✔ unique · ✔ visible · ✔ role and name). Role slider with exact name 'Loan amount' excludes the spinbutton that shares the same label and matches only the range slider.
- **Rejected:** none

## `dashboard.recentDisbursementsTable`

- **Scenario:** Positional locator - the recent disbursements table starts with the newest loan
- **Failed locator:** `page.locator('table').first()`
- **Claude:** 3.5 s, $0.002 · prompt in `prompts/dashboard.recentDisbursementsTable.txt`
- **Accepted:** `page.getByRole('table', { name: 'Recent disbursements', exact: true })` (✔ unique · ✔ visible · ✔ role and name). The page exposes a table whose accessible name is exactly 'Recent disbursements', which matches the expected fingerprint and is unique.
- **Rejected:** none

## `dashboard.exportCsvButton`

- **Scenario:** Removed feature - exporting the loan book as CSV
- **Failed locator:** `page.getByRole('button', { name: 'Export CSV' })`
- **Claude:** 3.2 s, $0.001 · prompt in `prompts/dashboard.exportCsvButton.txt`
- **Accepted:** nothing; the test stays red for a person to look at
- **Rejected:** none
