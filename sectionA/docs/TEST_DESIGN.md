# Test design

How the test conditions in Section A were chosen, and how I know they are enough. The happy paths come from the brief. Everything else comes from standard black-box techniques (ISTQB Foundation, chapter 4), the OWASP Web Security Testing Guide, and a mutation check on the suite itself.

Two rules decide whether a scenario exists:

1. **It names the break it catches.** A scenario stays only if some realistic change to the code would make it fail, and would make no other scenario fail for the same reason. That rule was applied by hand, row by row ([what was cut and why](#what-was-cut-and-why)). The mutation check below proves the converse mechanically: every planted bug fails at least one scenario, so the cuts removed no protection that the mutants measure. The rule is applied per property: JSONPlaceholder's two features ask different questions of the same payload (see the strategy table).

2. **It is tested once, at the layer that owns the rule.** The web app has no API: its validation rules run in the browser ([`app/src/data`](../app/src/data)), and the UI suite tests them through the screens, with one row per field and one per kind of refusal rather than every boundary.

## Strategy: which layer owns which risk

| Suite | Scenarios | Owns | Deliberately does not repeat |
|---|---|---|---|
| LoanLens UI (A2) | 57 | What only a browser shows: navigation; every figure, date, tenure and chart mark read back strictly and checked against the oracle, with every bar of all four bar charts drawn to scale; the bar tooltip on hover and keyboard focus (one chart); URL-synced state; how a `type="number"` box handles keystrokes; the data layer's refusal landing on the right field; XSS sinks under a Content-Security-Policy; the headers, methods and paths of the pages themselves. | Boundary-by-boundary rows: each field gets one out-of-range row, and each kind of refusal one row. Each filter is exercised once through the form. |
| JSONPlaceholder (A3) | 36 | One row per distinct way to crash a server (robustness), one per invalid-input partition (validation), 4 controls. The brief's sentence has two halves, so the features ask two questions of a payload: does the server crash, and is the input rejected? A payload can be in both. The two that crash the server (JP-01, JP-02) fail both, so the 20 red rows are 18 distinct inputs. | A second payload of the same partition, such as 10,000 characters next to 256 and 1,000,000. |
| SQL (A4) | 6 | Each query against two oracles that must agree: a table worked out by hand, one row per rule, and a TypeScript oracle. The near misses (one second or one paisa past a limit) must exist in the seed and stay unreported. A deliberately wrong query must be rejected, and the brief's output screenshot is regenerated. | A scenario per result row: each row is a line of one table, so a broken rule fails one scenario whose message names the row. |

### Not automated, and why

| What | Why |
|---|---|
| Load, performance, rate limiting | Out of scope for the brief. The web app's server only serves static files; every query runs in the browser over the mock data. |
| Authentication and authorisation | LoanLens has no users, by design of the brief. There is nothing to bypass. |
| HSTS (WSTG-CONF-07) | Not applicable: LoanLens is served over plain HTTP on localhost. A deployment behind TLS would add `Strict-Transport-Security`. |
| Browsers other than Chromium; a full accessibility audit | Locators are role-based, so missing roles or names fail tests, but WCAG contrast and focus order are not audited. |
| Probing JSONPlaceholder beyond normal use | It is a third-party site. It was used only the way a client would use it: single requests. |

## Techniques

| Technique | What it produces here | Example |
|---|---|---|
| **Equivalence partitioning** | For every input: one valid class and several invalid classes, one representative each. | Calculator amount: valid digits · negative · empty · exponent · fractions of a paisa. Report page: text · zero · decimal |
| **Boundary value analysis** | The value on each limit and the nearest value past it. Every limit is enforced by one validator in the data layer, so the UI proves that each field's refusal lands on that field, not every edge of every field. | Each calculator field out of range (amount −₹23,83,434, rate −8.5%, tenure 50 years) · a 0% rate (a real product) · `?page=0`, and a page past the end (9,999 of 12) |
| **Error guessing** | A checklist of things people really type or paste, and things that break parsers. | `--5`, `1e6`, `100000.555` (fractions of a paisa), `12abc34`, `?page=1.5`, a malformed escape in a loan URL (`/loans/%E0%A4%A`), markup in `?q=` |
| **State transitions** | The state across events, not just its final value. | Tenure years → months keeps the EMI · Report page 1 → past-the-end → "Go to page 12" · Back and Reset keep the URL and the form in step · a shared report URL restores its filters, sort and page |
| **Event coverage** | Inputs committed in more than one way. | The bar tooltip on hover and on keyboard focus · `--5`, which a number box keeps but never reports to React's `onChange`, so the app reads the native `input` event |
| **Security probes** (OWASP WSTG) | Hostile input at every place the app reflects it, and the server's own hardening. | Mapped by test ID, below |
| **Mutation testing** | Realistic bugs, written by hand and planted one at a time, to prove the suite notices each. | 18 hand-written mutants, below |

## Expected behaviour for invalid input

The brief does not specify validation, so this repo uses one rule, applied the same way everywhere:

> **Refuse the entry, or calculate with exactly what the box shows. Never quietly calculate with something else.**

"Refuse" means a visible message on the field, with the old plan hidden. In the LoanLens calculator every out-of-range, over-precise or unreadable entry gets a message on its own field, and the yearly chart and amortisation table are hidden until it is fixed. `12abc34` shows the other half of the rule: the browser drops the letters, the box shows `1234`, and the plan is for ₹1,234, so the box and the plan agree.

## How each result is judged

- **Independent oracle.** Expected numbers come from [`framework/oracles/emi.ts`](../framework/oracles/emi.ts) and [`loan-book.ts`](../framework/oracles/loan-book.ts), which never import app code. The loan-book oracle reads the same mock data file the app reads.
- **Screens are read back strictly.** UI figures show whole rupees, so every rupee figure, the dashboard's EMI inflow included, is checked within ₹0.51 (display rounding plus the app's paisa rounding); truncating instead of rounding fails 29 scenarios (mutant U05). Dates (`24 Sept 2025`) and tenures (`7 yr 6 mo`) are parsed back into data by strict readers in [`loanlens-ui/display.ts`](../loanlens-ui/display.ts) and compared with the loan book. Bars are checked twice on all four bar charts: the value each segment carries, and the height it is drawn at, which must be the same pixels per unit for every segment of every bar (within 1 px). No seeded loan has a part-year tenure, so one scenario stubs a 90-month tenure into LN-1001's mock data as the browser loads it, to reach the "7 yr 6 mo" form; it is the suite's only stubbed response.
- **Measure before asserting.** JSONPlaceholder's behaviour was probed on the live site first ([`FINDINGS.md`](../jsonplaceholder/FINDINGS.md)). The assertions encode what a correct API would do, not the observed behaviour.
- **Known defects stay red.** A failing row is tagged `@known-defect` and written up; the assertion is not loosened. `npm test` exits 1 only on untagged failures.

## Security testing

Every probe runs against the LoanLens web app only. IDs are from the [OWASP WSTG checklist](https://github.com/OWASP/wstg/blob/master/checklists/checklist.md) on its `master` branch, which numbers input tests `INJT`.

| ID | Risk | Test | Result |
|---|---|---|---|
| WSTG-INJT-01, WSTG-CLNT-01 | Reflected and DOM-based XSS | `<img src=x onerror=alert(1)>` in the three places the UI echoes the URL: the report's search box, its page note, and the loan-not-found message. Four checks: the text is shown literally; parsing the page's HTML builds no element from it; no dialog opens; the CSP blocked nothing. The last check means a pass cannot come from the CSP stopping an attack the app let through. | Pass |
| WSTG-CONF-12 | Content-Security-Policy | `default-src`, `script-src`, `object-src` and `frame-ancestors`, each compared exactly (so `'unsafe-inline'` added to `script-src` fails), on `/` and on the single-page fallback `/reports`. Every UI scenario that renders a page (53 of 57) also fails if the CSP blocks anything or the page throws an uncaught error, so each doubles as a check that the app still runs under the policy. The other 4 send requests without a page. | **Fixed:** no CSP was sent |
| WSTG-CLNT-09 | Clickjacking | `frame-ancestors 'none'`, as above. | **Fixed** |
| WSTG-CONF-14 | Other security headers | `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` on `/` and `/reports`. | **Fixed:** neither was sent |
| WSTG-CONF-06 | HTTP methods | `POST /` gets a JSON 405 with `Allow: GET, HEAD`. One middleware refuses every method but GET and HEAD, so one method is automated. | **Fixed:** pages answered `POST /` with Express's HTML "Cannot POST /" |
| WSTG-ATHZ-01 | Path traversal | `/..%2f..%2fpackage.json` returns the app's own page, not the file. Three more encodings (`%2e%2e/`, under `/assets/`, a raw `../`) behaved the same when tried once by hand. | Pass |
| WSTG-ERRH-01 | Error handling | `/loans/%E0%A4%A` (broken percent-encoding) shows "not a valid loan ID" instead of crashing. | **Fixed:** the page threw `URIError` while building its title |

## Mutation check: proof that the tests can fail

`npm run test:mutation` ([`scripts/mutation-check.mjs`](../scripts/mutation-check.mjs)) copies this folder to a temporary one, runs a green baseline, then plants one realistic bug at a time and runs the UI suite against it. Source files are never modified; the only file it writes here is [`reports/mutation/SUMMARY.md`](../reports/mutation/SUMMARY.md). The mutants are written by hand, one per bug I would expect a person to make in that line, not generated by a tool. All 18 are planted in the web app (its server, its in-browser data layer and its UI), and the UI suite has to catch each from the screen alone.

A mutant counts as **killed** only if the suite ran to completion with the baseline's scenario count and a step or an After-hook assertion failed. A run that broke in a Before hook (the app did not start, say), or that ran a different number of scenarios, is reported as an **error**, not a kill. The script exits 1 if any mutant survives or errors.

| Area | Mutants | Examples of the planted bug |
|---|---|---|
| Web server (`app/server.ts`) | 3 | `frame-ancestors` removed, `'unsafe-inline'` added to `script-src`, pages answering write methods |
| In-browser data layer (`app/src/data`) | 6 | a 360-day year, the paisa limit dropped, EMI inflow counting closed loans, case-sensitive search, the city filter ignored, sort direction ignored |
| UI (pages, `lib/format.ts`, `BarChart.tsx`, `App.tsx`) | 9 | `--5` ignored, `1e6` read as a number, `?page=1.5` treated as a page, the loan id from the URL rendered as HTML, rupees truncated instead of rounded, dates formatted in a US time zone, stacked bar segments drawn from the axis instead of the segment below, tenure shown without its remaining months, a malformed URL escape crashing the page title |

**Result (2026-10-07, 14 min 31 s): 18 killed, 0 equivalent, 0 survived, 0 errored.** The summary lists, for each mutant, the scenarios that caught it.

Two results changed the suite rather than the code:

- **U08, the tenure label without its remaining months ("7 yr" for 90 months), had no scenario that could reach it.** None of the 120 seeded loans has a part-year tenure, so no screen rendered that branch. I first marked it "equivalent"; a reviewer called that a relabel, which it was. A loan-detail scenario now stubs a 90-month tenure into the loan's mock data and reads the label back, and U08 fails it.
- **D02, the paisa limit dropped from the web app's data layer, survived.** Before the sections were split, the web app used the API, the rule lived only there, and the UI row for it (`2500000.555`) had been cut as a duplicate of the API's. Once the web app carried its own copy of the rules, nothing in this section could catch it. The row is back as `100000.555`.

## What was cut and why

The suites went from 69 → 57 (UI), 51 → 36 (JSONPlaceholder) and 40 → 6 (SQL) scenarios. The UI count includes rows added during review: the page-level security rows, the malformed loan URL, the part-year tenure and the restored paisa row. Each row below was removed because the row named in the second column fails for the same cause.

| Removed | Still caught by |
|---|---|
| **UI:** zero, negative and 0.01-year tenure; amount 500; `1e1`; a lone `-` | Each field's out-of-range row (one range check per field); `1e6` (same check); `--5` (same `badInput` path) |
| **UI:** `abc`, `!@#$%`, Devanagari typed into the amount box | Nothing to test in the app: Chromium's number box refuses every key, so this tested the browser. The resulting empty box is the "left empty" row |
| **UI:** report rows for "car loans in Mumbai over ₹10 lakh", `?page=-3`, search for HTML/SQL text; three extra loan-detail ids | The filter outline; `?page=0`; the XSS sink outline; loan LN-1001 |
| **JSONPlaceholder:** 10,000- and 1,000,000-character titles in validation; 1 MB body; control characters; zero-width and bidi in robustness; `{}` and a form body in validation | 256 characters (validation) and 1,000,000 (robustness); NUL; bidi (validation); missing fields. Listed in the findings as measured once |
| **SQL:** 34 per-row scenarios ("Reported", "Not reported", "One row per streak"), each repeating a row of the exact-match check | The hand-worked tables in each feature's main scenario. The near misses are still checked to exist in the seed, which the per-row scenarios did too |

Two rows were put back after the mutation check showed each was the only killer: `?page=1.5` in the Reports UI is the sole test that a decimal page number is not treated as a page (mutant U03), and `100000.555` in the calculator the sole test of the paisa limit in the web app's own data layer (mutant D02).

## Coverage by surface

### LoanLens calculator UI (A1/A2)

The UI uses `type="number"` inputs, so the browser filters keystrokes before the app sees them. The tests type key by key (`pressSequentially`) where that matters; `fill()` cannot produce what a person can.

| Condition | Result |
|---|---|
| Negative amount, negative rate, 50 years | The data layer's refusal on the right field, in that field's words. The tenure message names the unit: "…between 1 and 480 (got 600 months)". **Fixed:** it used to say "between 1 and 480" for years. |
| `1e6` (allowed by a number box) | "…must be written in plain digits, for example 2500000." **Fixed:** it used to say "must be a number", which `1e6` is. |
| `--5` (the browser keeps the text but cannot read it) | "Loan amount must be a number." **Fixed:** it used to say "Enter a loan amount". React's `onChange` never fires for this, so the app reads `validity.badInput` on the native `input` event. |
| `12abc34` | The browser drops the letters and the box shows `1234`. The results match ₹1,234, so the box and the plan agree. |

### LoanLens Reports UI

| Condition | Result |
|---|---|
| `?page=9999` | "There is no page 9,999. This report has 12 pages." with a **Go to page 12** button. **Fixed:** it used to read "Showing 99981–120 of 120 loans". |
| `?page=abc`, `0`, `1.5` | Page 1, with a note that names the bad value. **Fixed:** the bad value used to be ignored silently. |
| Markup in `?q=` or `?page=` | Shown as text; see Security testing. |
