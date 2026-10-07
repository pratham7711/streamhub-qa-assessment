# Self-healing suggestions

A saved copy of `npm run heal -- --provider heuristic`, run at 2026-10-07T12:09:50.449Z against Section B's five broken locators on emicalculator.net, for comparison with the Claude run in [`reports/self-healing-healed/healing/SUGGESTIONS.md`](../../../reports/self-healing-healed/healing/SUGGESTIONS.md). This run's own incidents were not saved; the incident paths point at the same locators' incidents in that Claude run, which later runs overwrite. It was run before the two sections became separate folders; its paths have been rewritten to the current layout, and the patches still apply. 4 of 5 broken locators have a validated suggestion; 4 replayed green.
Nothing here has been applied to the source. Each patch is for a person to review and `git apply`.

| Locator | Failure | Failed locator | Suggested | Replay |
|---|---|---|---|---|
| `emicalculator.loanTenureBox` | no-match | `page.locator('#loan-term')` | `page.getByRole('textbox', { name: 'Loan Tenure', exact: true })` | passed |
| `emicalculator.personalLoanTab` | no-match | `page.getByRole('link', { name: 'Personal Loans', exact: true })` | `page.getByRole('link', { name: 'Personal Loan', exact: true })` | passed |
| `emicalculator.homeLoanAmountBox` | ambiguous | `page.getByRole('textbox', { name: /loan/i })` | `page.getByRole('textbox', { name: 'Home Loan Amount', exact: true })` | passed |
| `emicalculator.interestRateBox` | wrong-element | `page.locator('input[type="text"]').last()` | `page.getByRole('textbox', { name: 'Interest Rate', exact: true })` | passed |
| `emicalculator.emailScheduleButton` | no-match | `page.getByRole('button', { name: 'Email schedule' })` | **none passed validation** | not-run |

### `emicalculator.loanTenureBox`

- **Scenario:** Wrong id - the tenure box sets the loan tenure
- **Declared at:** `self-healing/pages/LegacyEmiLocators.ts:62`
- **Failure:** no-match. No element matched within 5 s.
- **Failed locator:** `page.locator('#loan-term')`
- **Provider:** heuristic (0.0 s)
- **Incident:** `reports/self-healing-healed/healing/incidents/emicalculator.loanTenureBox.json`

**Accepted:** `page.getByRole('textbox', { name: 'Loan Tenure', exact: true })` (confidence 1)

Best textual and structural match (score 1.03): textbox "Loan Tenure".

Validation: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✔ fingerprint: role and name. Replay of the scenario on the healed locator: **passed**.

```diff
--- a/self-healing/pages/LegacyEmiLocators.ts
+++ b/self-healing/pages/LegacyEmiLocators.ts
@@ -59,7 +59,7 @@
   readonly emailScheduleButton;
 
   constructor(page: Page) {
-    this.loanTenureBox = healable(page, TENURE_BOX, (p) => p.locator('#loan-term'));
+    this.loanTenureBox = healable(page, TENURE_BOX, (p) => p.getByRole('textbox', { name: 'Loan Tenure', exact: true }));
     this.personalLoanTab = healable(page, PERSONAL_LOAN_TAB, (p) => p.getByRole('link', { name: 'Personal Loans', exact: true }));
     this.homeLoanAmountBox = healable(page, AMOUNT_BOX, (p) => p.getByRole('textbox', { name: /loan/i }));
     this.interestRateBox = healable(page, RATE_BOX, (p) => p.locator('input[type="text"]').last());
```

**Other candidates:**
- `page.getByLabel('Loan Tenure', { exact: true })`: passed validation, ranked below the accepted one (confidence 1)
- `page.getByRole('textbox', { name: 'Home Loan Amount', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role textbox named Loan Tenure)
- `page.getByLabel('Home Loan Amount', { exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role textbox named Loan Tenure)

---

### `emicalculator.personalLoanTab`

- **Scenario:** Wrong link text - the Personal Loan tab switches the calculator
- **Declared at:** `self-healing/pages/LegacyEmiLocators.ts:63`
- **Failure:** no-match. No element matched within 5 s.
- **Failed locator:** `page.getByRole('link', { name: 'Personal Loans', exact: true })`
- **Provider:** heuristic (0.0 s)
- **Incident:** `reports/self-healing-healed/healing/incidents/emicalculator.personalLoanTab.json`

**Accepted:** `page.getByRole('link', { name: 'Personal Loan', exact: true })` (confidence 1)

Best textual and structural match (score 1.15): link "Personal Loan".

Validation: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✔ fingerprint: role and name. Replay of the scenario on the healed locator: **passed**.

```diff
--- a/self-healing/pages/LegacyEmiLocators.ts
+++ b/self-healing/pages/LegacyEmiLocators.ts
@@ -60,7 +60,7 @@
 
   constructor(page: Page) {
     this.loanTenureBox = healable(page, TENURE_BOX, (p) => p.locator('#loan-term'));
-    this.personalLoanTab = healable(page, PERSONAL_LOAN_TAB, (p) => p.getByRole('link', { name: 'Personal Loans', exact: true }));
+    this.personalLoanTab = healable(page, PERSONAL_LOAN_TAB, (p) => p.getByRole('link', { name: 'Personal Loan', exact: true }));
     this.homeLoanAmountBox = healable(page, AMOUNT_BOX, (p) => p.getByRole('textbox', { name: /loan/i }));
     this.interestRateBox = healable(page, RATE_BOX, (p) => p.locator('input[type="text"]').last());
     this.emailScheduleButton = healable(page, EMAIL_SCHEDULE, (p) => p.getByRole('button', { name: 'Email schedule' }));
```

**Other candidates:**
- `page.getByRole('listitem', { name: 'Personal Loan', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✖ unique match (0 element(s) matched)
- `page.getByRole('link', { name: 'loan calculator', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role link named Personal Loan)
- `page.getByRole('link', { name: 'LOAN CALCULATOR', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✖ unique match (0 element(s) matched)

---

### `emicalculator.homeLoanAmountBox`

- **Scenario:** Ambiguous name - the amount box sets the principal
- **Declared at:** `self-healing/pages/LegacyEmiLocators.ts:64`
- **Failure:** ambiguous. 2 elements matched; an action on it would violate strict mode.
- **Failed locator:** `page.getByRole('textbox', { name: /loan/i })`
- **Provider:** heuristic (0.0 s)
- **Incident:** `reports/self-healing-healed/healing/incidents/emicalculator.homeLoanAmountBox.json`

**Accepted:** `page.getByRole('textbox', { name: 'Home Loan Amount', exact: true })` (confidence 0.95)

Best textual and structural match (score 0.95): textbox "Home Loan Amount".

Validation: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✔ fingerprint: role and name. Replay of the scenario on the healed locator: **passed**.

```diff
--- a/self-healing/pages/LegacyEmiLocators.ts
+++ b/self-healing/pages/LegacyEmiLocators.ts
@@ -61,7 +61,7 @@
   constructor(page: Page) {
     this.loanTenureBox = healable(page, TENURE_BOX, (p) => p.locator('#loan-term'));
     this.personalLoanTab = healable(page, PERSONAL_LOAN_TAB, (p) => p.getByRole('link', { name: 'Personal Loans', exact: true }));
-    this.homeLoanAmountBox = healable(page, AMOUNT_BOX, (p) => p.getByRole('textbox', { name: /loan/i }));
+    this.homeLoanAmountBox = healable(page, AMOUNT_BOX, (p) => p.getByRole('textbox', { name: 'Home Loan Amount', exact: true }));
     this.interestRateBox = healable(page, RATE_BOX, (p) => p.locator('input[type="text"]').last());
     this.emailScheduleButton = healable(page, EMAIL_SCHEDULE, (p) => p.getByRole('button', { name: 'Email schedule' }));
   }
```

**Other candidates:**
- `page.getByLabel('Home Loan Amount', { exact: true })`: passed validation, ranked below the accepted one (confidence 0.95)
- `page.getByRole('textbox', { name: 'Loan Tenure', exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role textbox named Home Loan Amount)
- `page.getByLabel('Loan Tenure', { exact: true })`: **rejected**: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✖ fingerprint: role and name (element does not have role textbox named Home Loan Amount)

---

### `emicalculator.interestRateBox`

- **Scenario:** Positional locator - the interest rate box sets the rate
- **Declared at:** `self-healing/pages/LegacyEmiLocators.ts:65`
- **Failure:** wrong-element. Resolved, but element does not have role textbox named Interest Rate.
- **Failed locator:** `page.locator('input[type="text"]').last()`
- **Provider:** heuristic (0.0 s)
- **Incident:** `reports/self-healing-healed/healing/incidents/emicalculator.interestRateBox.json`

**Accepted:** `page.getByRole('textbox', { name: 'Interest Rate', exact: true })` (confidence 0.82)

Best textual and structural match (score 0.82): textbox "Interest Rate".

Validation: ✔ vocabulary · ✔ differs from failed locator · ✔ unique match · ✔ visible · ✔ fingerprint: role and name. Replay of the scenario on the healed locator: **passed**.

```diff
--- a/self-healing/pages/LegacyEmiLocators.ts
+++ b/self-healing/pages/LegacyEmiLocators.ts
@@ -62,7 +62,7 @@
     this.loanTenureBox = healable(page, TENURE_BOX, (p) => p.locator('#loan-term'));
     this.personalLoanTab = healable(page, PERSONAL_LOAN_TAB, (p) => p.getByRole('link', { name: 'Personal Loans', exact: true }));
     this.homeLoanAmountBox = healable(page, AMOUNT_BOX, (p) => p.getByRole('textbox', { name: /loan/i }));
-    this.interestRateBox = healable(page, RATE_BOX, (p) => p.locator('input[type="text"]').last());
+    this.interestRateBox = healable(page, RATE_BOX, (p) => p.getByRole('textbox', { name: 'Interest Rate', exact: true }));
     this.emailScheduleButton = healable(page, EMAIL_SCHEDULE, (p) => p.getByRole('button', { name: 'Email schedule' }));
   }
 }
```

**Other candidates:**
- `page.getByLabel('Interest Rate', { exact: true })`: passed validation, ranked below the accepted one (confidence 0.82)

---

### `emicalculator.emailScheduleButton`

- **Scenario:** Missing feature - e-mailing the repayment schedule
- **Declared at:** `self-healing/pages/LegacyEmiLocators.ts:66`
- **Failure:** no-match. No element matched within 5 s.
- **Failed locator:** `page.getByRole('button', { name: 'Email schedule' })`
- **Provider:** heuristic (0.0 s)
- **Incident:** `reports/self-healing-healed/healing/incidents/emicalculator.emailScheduleButton.json`

**No suggestion passed validation.** The test stays red; a person has to look at it.

**Other candidates:**
- none
