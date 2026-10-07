# Self-healing suggestions

Generated 2026-10-07T12:28:04.277Z. 4 of 5 broken locators have a validated suggestion; 4 replayed green.
Nothing here has been applied to the source. Each patch is for a person to review and `git apply`.

| Locator | Failure | Failed locator | Suggested | Replay |
|---|---|---|---|---|
| `dashboard.totalLoansValue` | no-match | `page.getByTestId('kpi-total-loans')` | `page.getByRole('group', { name: 'Total loans' }).getByTestId('kpi-value')` | passed |
| `reports.applyFiltersButton` | no-match | `page.getByRole('button', { name: 'Apply filter', exact: true })` | `page.getByRole('button', { name: 'Apply filters', exact: true })` | passed |
| `calculator.loanAmountSlider` | ambiguous | `page.getByLabel('Loan amount')` | `page.getByRole('slider', { name: 'Loan amount' })` | passed |
| `dashboard.recentDisbursementsTable` | wrong-element | `page.locator('table').first()` | `page.getByRole('table', { name: 'Recent disbursements', exact: true })` | passed |
| `reports.exportCsvButton` | no-match | `page.getByRole('button', { name: 'Export CSV' })` | **none passed validation** | not-run |

### `dashboard.totalLoansValue`

- **Scenario:** Renamed test id - the Total loans figure shows the size of the loan book
- **Declared at:** `section-a/self-healing/pages/LegacyLocators.ts:61`
- **Failure:** no-match. No element matched within 5 s.
- **Failed locator:** `page.getByTestId('kpi-total-loans')`
- **Provider:** claude-cli (sonnet) (5.4 s, $0.0367)
- **Incident:** `section-a/reports/self-healing-healed/healing/incidents/dashboard.totalLoansValue.json`

**Accepted:** `page.getByRole('group', { name: 'Total loans' }).getByTestId('kpi-value')` (confidence 0.92)

The kpi-value test id is the only value element inside the "Total loans" group, and it shows 120, which fits the numeric fingerprint.

Validation: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✔ fingerprint: container · ✔ fingerprint: text. Replay of the scenario on the healed locator: **passed**.

```diff
--- a/section-a/self-healing/pages/LegacyLocators.ts
+++ b/section-a/self-healing/pages/LegacyLocators.ts
@@ -58,7 +58,7 @@
   readonly exportCsvButton;
 
   constructor(private readonly page: Page) {
-    this.totalLoansValue = healable(page, TOTAL_LOANS, (p) => p.getByTestId('kpi-total-loans'));
+    this.totalLoansValue = healable(page, TOTAL_LOANS, (p) => p.getByRole('group', { name: 'Total loans' }).getByTestId('kpi-value'));
     this.applyFiltersButton = healable(page, APPLY_FILTERS, (p) => p.getByRole('button', { name: 'Apply filter', exact: true }));
     this.loanAmountSlider = healable(page, AMOUNT_SLIDER, (p) => p.getByLabel('Loan amount'));
     this.recentDisbursementsTable = healable(page, RECENT_TABLE, (p) => p.locator('table').first());
```

**Other candidates:**
- `page.getByRole('group', { name: 'Total loans' }).getByText('120', { exact: true })`: passed validation, ranked below the accepted one (confidence 0.6)

---

### `reports.applyFiltersButton`

- **Scenario:** Changed button text - applying a status filter narrows the report
- **Declared at:** `section-a/self-healing/pages/LegacyLocators.ts:62`
- **Failure:** no-match. No element matched within 5 s.
- **Failed locator:** `page.getByRole('button', { name: 'Apply filter', exact: true })`
- **Provider:** claude-cli (sonnet) (6.5 s, $0.0457)
- **Incident:** `section-a/reports/self-healing-healed/healing/incidents/reports.applyFiltersButton.json`

**Accepted:** `page.getByRole('button', { name: 'Apply filters', exact: true })` (confidence 0.97)

The form contains a single button named exactly 'Apply filters', which matches the /^apply/i fingerprint and submits the report filters.

Validation: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✔ fingerprint: role and name. Replay of the scenario on the healed locator: **passed**.

```diff
--- a/section-a/self-healing/pages/LegacyLocators.ts
+++ b/section-a/self-healing/pages/LegacyLocators.ts
@@ -59,7 +59,7 @@
 
   constructor(private readonly page: Page) {
     this.totalLoansValue = healable(page, TOTAL_LOANS, (p) => p.getByTestId('kpi-total-loans'));
-    this.applyFiltersButton = healable(page, APPLY_FILTERS, (p) => p.getByRole('button', { name: 'Apply filter', exact: true }));
+    this.applyFiltersButton = healable(page, APPLY_FILTERS, (p) => p.getByRole('button', { name: 'Apply filters', exact: true }));
     this.loanAmountSlider = healable(page, AMOUNT_SLIDER, (p) => p.getByLabel('Loan amount'));
     this.recentDisbursementsTable = healable(page, RECENT_TABLE, (p) => p.locator('table').first());
     this.exportCsvButton = healable(page, EXPORT_CSV, (p) => p.getByRole('button', { name: 'Export CSV' }));
```

**Other candidates:**
- `page.getByRole('form', { name: 'Report filters' }).getByRole('button', { name: 'Apply filters', exact: true })`: passed validation, ranked below the accepted one (confidence 0.9)

---

### `calculator.loanAmountSlider`

- **Scenario:** Ambiguous label - the loan amount slider updates the number box
- **Declared at:** `section-a/self-healing/pages/LegacyLocators.ts:63`
- **Failure:** ambiguous. 2 elements matched; an action on it would violate strict mode.
- **Failed locator:** `page.getByLabel('Loan amount')`
- **Provider:** claude-cli (sonnet) (4.0 s, $0.0495)
- **Incident:** `section-a/reports/self-healing-healed/healing/incidents/calculator.loanAmountSlider.json`

**Accepted:** `page.getByRole('slider', { name: 'Loan amount' })` (confidence 0.97)

Role slider with exact name 'Loan amount' is unique, since the other same-named element is a spinbutton.

Validation: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✔ fingerprint: role and name. Replay of the scenario on the healed locator: **passed**.

```diff
--- a/section-a/self-healing/pages/LegacyLocators.ts
+++ b/section-a/self-healing/pages/LegacyLocators.ts
@@ -60,7 +60,7 @@
   constructor(private readonly page: Page) {
     this.totalLoansValue = healable(page, TOTAL_LOANS, (p) => p.getByTestId('kpi-total-loans'));
     this.applyFiltersButton = healable(page, APPLY_FILTERS, (p) => p.getByRole('button', { name: 'Apply filter', exact: true }));
-    this.loanAmountSlider = healable(page, AMOUNT_SLIDER, (p) => p.getByLabel('Loan amount'));
+    this.loanAmountSlider = healable(page, AMOUNT_SLIDER, (p) => p.getByRole('slider', { name: 'Loan amount' }));
     this.recentDisbursementsTable = healable(page, RECENT_TABLE, (p) => p.locator('table').first());
     this.exportCsvButton = healable(page, EXPORT_CSV, (p) => p.getByRole('button', { name: 'Export CSV' }));
   }
```

**Other candidates:**
- none

---

### `dashboard.recentDisbursementsTable`

- **Scenario:** Positional locator - the recent disbursements table starts with the newest loan
- **Declared at:** `section-a/self-healing/pages/LegacyLocators.ts:64`
- **Failure:** wrong-element. Resolved, but element does not have role table named Recent disbursements.
- **Failed locator:** `page.locator('table').first()`
- **Provider:** claude-cli (sonnet) (4.1 s, $0.0342)
- **Incident:** `section-a/reports/self-healing-healed/healing/incidents/dashboard.recentDisbursementsTable.json`

**Accepted:** `page.getByRole('table', { name: 'Recent disbursements', exact: true })` (confidence 0.97)

The table with role table and exact accessible name 'Recent disbursements' is the single match for the fingerprint.

Validation: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✔ fingerprint: role and name. Replay of the scenario on the healed locator: **passed**.

```diff
--- a/section-a/self-healing/pages/LegacyLocators.ts
+++ b/section-a/self-healing/pages/LegacyLocators.ts
@@ -61,7 +61,7 @@
     this.totalLoansValue = healable(page, TOTAL_LOANS, (p) => p.getByTestId('kpi-total-loans'));
     this.applyFiltersButton = healable(page, APPLY_FILTERS, (p) => p.getByRole('button', { name: 'Apply filter', exact: true }));
     this.loanAmountSlider = healable(page, AMOUNT_SLIDER, (p) => p.getByLabel('Loan amount'));
-    this.recentDisbursementsTable = healable(page, RECENT_TABLE, (p) => p.locator('table').first());
+    this.recentDisbursementsTable = healable(page, RECENT_TABLE, (p) => p.getByRole('table', { name: 'Recent disbursements', exact: true }));
     this.exportCsvButton = healable(page, EXPORT_CSV, (p) => p.getByRole('button', { name: 'Export CSV' }));
   }
 
```

**Other candidates:**
- none

---

### `reports.exportCsvButton`

- **Scenario:** Removed feature - exporting the report as CSV
- **Declared at:** `section-a/self-healing/pages/LegacyLocators.ts:65`
- **Failure:** no-match. No element matched within 5 s.
- **Failed locator:** `page.getByRole('button', { name: 'Export CSV' })`
- **Provider:** claude-cli (sonnet) (11.7 s, $0.0451)
- **Incident:** `section-a/reports/self-healing-healed/healing/incidents/reports.exportCsvButton.json`

**No suggestion passed validation.** The test stays red; a person has to look at it.

**Other candidates:**
- none
