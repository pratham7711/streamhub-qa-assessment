# Self-healing suggestions

A saved copy of `npm run heal -- --section a --provider heuristic`, run at 2026-10-07T12:07:41.000Z against Section A's five broken locators on the LoanLens web app, for comparison with the Claude run in [`section-a/reports/self-healing-healed/healing/SUGGESTIONS.md`](../../../../section-a/reports/self-healing-healed/healing/SUGGESTIONS.md). This run's own incidents were not saved; the incident paths point at the same locators' incidents in that Claude run, which later runs overwrite. 4 of 5 broken locators have a validated suggestion; 4 replayed green.
Nothing here has been applied to the source. Each patch is for a person to review and `git apply`.

| Locator | Failure | Failed locator | Suggested | Replay |
|---|---|---|---|---|
| `dashboard.totalLoansValue` | no-match | `page.getByTestId('kpi-total-loans')` | `page.getByRole('group', { name: 'Total loans', exact: true }).getByTestId('kpi-value')` | passed |
| `reports.applyFiltersButton` | no-match | `page.getByRole('button', { name: 'Apply filter', exact: true })` | `page.getByRole('button', { name: 'Apply filters', exact: true })` | passed |
| `calculator.loanAmountSlider` | ambiguous | `page.getByLabel('Loan amount')` | `page.getByRole('slider', { name: 'Loan amount', exact: true })` | passed |
| `dashboard.recentDisbursementsTable` | wrong-element | `page.locator('table').first()` | `page.getByRole('table', { name: 'Recent disbursements', exact: true })` | passed |
| `reports.exportCsvButton` | no-match | `page.getByRole('button', { name: 'Export CSV' })` | **none passed validation** | not-run |

### `dashboard.totalLoansValue`

- **Scenario:** Renamed test id - the Total loans figure shows the size of the loan book
- **Declared at:** `section-a/self-healing/pages/LegacyLocators.ts:61`
- **Failure:** no-match. No element matched within 5 s.
- **Failed locator:** `page.getByTestId('kpi-total-loans')`
- **Provider:** heuristic (0.0 s)
- **Incident:** `section-a/reports/self-healing-healed/healing/incidents/dashboard.totalLoansValue.json`

**Accepted:** `page.getByRole('group', { name: 'Total loans', exact: true }).getByTestId('kpi-value')` (confidence 0.8)

Best textual and structural match (score 0.80): testid "kpi-value" in group "Total loans".

Validation: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✔ fingerprint: container · ✔ fingerprint: text. Replay of the scenario on the healed locator: **passed**.

```diff
--- a/section-a/self-healing/pages/LegacyLocators.ts
+++ b/section-a/self-healing/pages/LegacyLocators.ts
@@ -58,7 +58,7 @@
   readonly exportCsvButton;
 
   constructor(private readonly page: Page) {
-    this.totalLoansValue = healable(page, TOTAL_LOANS, (p) => p.getByTestId('kpi-total-loans'));
+    this.totalLoansValue = healable(page, TOTAL_LOANS, (p) => p.getByRole('group', { name: 'Total loans', exact: true }).getByTestId('kpi-value'));
     this.applyFiltersButton = healable(page, APPLY_FILTERS, (p) => p.getByRole('button', { name: 'Apply filter', exact: true }));
     this.loanAmountSlider = healable(page, AMOUNT_SLIDER, (p) => p.getByLabel('Loan amount'));
     this.recentDisbursementsTable = healable(page, RECENT_TABLE, (p) => p.locator('table').first());
```

**Other candidates:**
- `page.getByTestId('kpi-value')`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✖ unique match (4 element(s) matched)

---

### `reports.applyFiltersButton`

- **Scenario:** Changed button text - applying a status filter narrows the report
- **Declared at:** `section-a/self-healing/pages/LegacyLocators.ts:62`
- **Failure:** no-match. No element matched within 5 s.
- **Failed locator:** `page.getByRole('button', { name: 'Apply filter', exact: true })`
- **Provider:** heuristic (0.0 s)
- **Incident:** `section-a/reports/self-healing-healed/healing/incidents/reports.applyFiltersButton.json`

**Accepted:** `page.getByRole('button', { name: 'Apply filters', exact: true })` (confidence 1)

Best textual and structural match (score 1.25): button "Apply filters" in form "Report filters".

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
- `page.getByRole('form', { name: 'Report filters', exact: true }).getByRole('button', { name: 'Apply filters', exact: true })`: passed validation, ranked below the accepted one (confidence 1)
- `page.getByRole('button', { name: 'Reset', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role button named /^apply/i)
- `page.getByRole('form', { name: 'Report filters', exact: true }).getByRole('button', { name: 'Reset', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role button named /^apply/i)

---

### `calculator.loanAmountSlider`

- **Scenario:** Ambiguous label - the loan amount slider updates the number box
- **Declared at:** `section-a/self-healing/pages/LegacyLocators.ts:63`
- **Failure:** ambiguous. 2 elements matched; an action on it would violate strict mode.
- **Failed locator:** `page.getByLabel('Loan amount')`
- **Provider:** heuristic (0.0 s)
- **Incident:** `section-a/reports/self-healing-healed/healing/incidents/calculator.loanAmountSlider.json`

**Accepted:** `page.getByRole('slider', { name: 'Loan amount', exact: true })` (confidence 1)

Best textual and structural match (score 1.41): slider "Loan amount" in form "Loan details".

Validation: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✔ fingerprint: role and name. Replay of the scenario on the healed locator: **passed**.

```diff
--- a/section-a/self-healing/pages/LegacyLocators.ts
+++ b/section-a/self-healing/pages/LegacyLocators.ts
@@ -60,7 +60,7 @@
   constructor(private readonly page: Page) {
     this.totalLoansValue = healable(page, TOTAL_LOANS, (p) => p.getByTestId('kpi-total-loans'));
     this.applyFiltersButton = healable(page, APPLY_FILTERS, (p) => p.getByRole('button', { name: 'Apply filter', exact: true }));
-    this.loanAmountSlider = healable(page, AMOUNT_SLIDER, (p) => p.getByLabel('Loan amount'));
+    this.loanAmountSlider = healable(page, AMOUNT_SLIDER, (p) => p.getByRole('slider', { name: 'Loan amount', exact: true }));
     this.recentDisbursementsTable = healable(page, RECENT_TABLE, (p) => p.locator('table').first());
     this.exportCsvButton = healable(page, EXPORT_CSV, (p) => p.getByRole('button', { name: 'Export CSV' }));
   }
```

**Other candidates:**
- `page.getByRole('form', { name: 'Loan details', exact: true }).getByRole('slider', { name: 'Loan amount', exact: true })`: passed validation, ranked below the accepted one (confidence 1)
- `page.getByRole('spinbutton', { name: 'Loan amount', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role slider named Loan amount)
- `page.getByRole('form', { name: 'Loan details', exact: true }).getByRole('spinbutton', { name: 'Loan amount', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role slider named Loan amount)
- `page.getByLabel('Loan amount', { exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✖ unique match (2 element(s) matched)
- `page.getByRole('form', { name: 'Loan details', exact: true }).getByLabel('Loan amount', { exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✖ unique match (2 element(s) matched)
- `page.getByRole('slider', { name: 'Loan tenure', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role slider named Loan amount)
- `page.getByRole('form', { name: 'Loan details', exact: true }).getByRole('slider', { name: 'Loan tenure', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role slider named Loan amount)

---

### `dashboard.recentDisbursementsTable`

- **Scenario:** Positional locator - the recent disbursements table starts with the newest loan
- **Declared at:** `section-a/self-healing/pages/LegacyLocators.ts:64`
- **Failure:** wrong-element. Resolved, but element does not have role table named Recent disbursements.
- **Failed locator:** `page.locator('table').first()`
- **Provider:** heuristic (0.0 s)
- **Incident:** `section-a/reports/self-healing-healed/healing/incidents/dashboard.recentDisbursementsTable.json`

**Accepted:** `page.getByRole('table', { name: 'Recent disbursements', exact: true })` (confidence 0.77)

Best textual and structural match (score 0.77): table "Recent disbursements".

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
- **Provider:** heuristic (0.0 s)
- **Incident:** `section-a/reports/self-healing-healed/healing/incidents/reports.exportCsvButton.json`

**No suggestion passed validation.** The test stays red; a person has to look at it.

**Other candidates:**
- `page.getByRole('button', { name: 'Disbursed', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role button named /export|csv|download/i)
- `page.getByRole('table', { name: 'Loans', exact: true }).getByRole('button', { name: 'Disbursed', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role button named /export|csv|download/i)
