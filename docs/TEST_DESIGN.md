# Test design

How the test conditions in this repo were chosen, and how I know they are enough. The happy paths come from the brief. Everything else comes from standard black-box techniques (ISTQB Foundation, chapter 4), the OWASP Web Security Testing Guide, and two checks on the suite itself: a property-based test and a mutation check.

Two rules decide whether a scenario exists:

1. **It names the break it catches.** A scenario stays only if some realistic change to the code would make it fail, and would make no other scenario fail for the same reason. That rule was applied by hand, row by row ([what was cut and why](#what-was-cut-and-why)). The mutation check below proves the converse mechanically: every planted bug fails at least one scenario, so the cuts removed no protection that the mutants measure. The rule is applied per property: JSONPlaceholder's two features ask different questions of the same payload (see the strategy table).
2. **It is tested once per section, at the layer that owns the rule.** In Section B the validation rules live in the API, so the API suite owns the partitions and boundaries. Section A's web app has no API: it carries its own copy of the rules in the browser ([`section-a/app/src/data`](../section-a/app/src/data)), and the UI suite tests them through the screens, with one row per field and one per kind of refusal. It does not repeat Section B's boundary-by-boundary rows.

## Strategy: which layer owns which risk

| Suite | Scenarios | Owns | Deliberately does not repeat |
|---|---|---|---|
| LoanLens API (B2) | 106 | Every validation rule: ranges, types, hostile numbers, unknown and repeated parameters, and every range filter at an edge that equals a real loan's value. The filter vocabulary (`/api/meta`) against the loan book. The money maths, against an oracle built from the request (never from the response's echo of it) and 200 random loans. Service hardening: methods, headers, caching, CORS, malformed URLs, a cap on the number of parameters. | UI rendering. Runs in about 3 s, so it is where breadth is cheap. |
| LoanLens UI (A2) | 57 | What only a browser shows: navigation; every figure, date, tenure and chart mark read back strictly and checked against the oracle, with every bar of all four bar charts drawn to scale; the bar tooltip on hover and keyboard focus (one chart); URL-synced state; how a `type="number"` box handles keystrokes; the data layer's refusal landing on the right field; XSS sinks under a Content-Security-Policy; the headers, methods and paths of the pages themselves. | Boundary-by-boundary rows: each field gets one out-of-range row, and each kind of refusal one row. Each filter is exercised once through the form. |
| emicalculator.net (B3) | 38 | The brief's TC1/TC2, valid formats the site handles, and one row per invalid partition that fails. Zero and letters are separate partitions even where the site turns both into ₹0: a fix for one does not fix the other. | A second input that fails for the same cause as an existing row. |
| JSONPlaceholder (A3) | 36 | One row per distinct way to crash a server (robustness), one per invalid-input partition (validation), 4 controls. The brief's sentence has two halves, so the features ask two questions of a payload: does the server crash, and is the input rejected? A payload can be in both. The two that crash the server (JP-01, JP-02) fail both, so the 20 red rows are 18 distinct inputs. | A second payload of the same partition, such as 10,000 characters next to 256 and 1,000,000. |
| SQL (A4/B4) | 6 | Each query against two oracles that must agree: a table worked out by hand, one row per rule, and a TypeScript oracle. The near misses (one second or one paisa past a limit) must exist in the seed and stay unreported. A deliberately wrong query must be rejected, and the brief's output screenshot is regenerated. | A scenario per result row: each row is a line of one table, so a broken rule fails one scenario whose message names the row. |

### Not automated, and why

| What | Why |
|---|---|
| Load, performance, rate limiting | Out of scope for the brief. LoanLens has no rate limiting; the API does bound every request (page size ≤ 100, page ≤ 10,000, search ≤ 50 characters), and those bounds are tested (OWASP API4). Request-rate limiting is a recorded gap for production. |
| Authentication and authorisation (OWASP API1, API2, API5) | LoanLens has no users, by design of the brief. There is nothing to bypass. |
| HSTS (WSTG-CONF-07) | Not applicable: LoanLens is served over plain HTTP on localhost. A deployment behind TLS would add `Strict-Transport-Security`. |
| Browsers other than Chromium; a full accessibility audit | Locators are role-based, so missing roles or names fail tests, but WCAG contrast and focus order are not audited. |
| Probing emicalculator.net or JSONPlaceholder beyond normal use | They are third-party sites. They were used only the way a person would use them: typed entries and single requests. |

## Techniques

| Technique | What it produces here | Example |
|---|---|---|
| **Equivalence partitioning** | For every input: one valid class and several invalid classes, one representative each. | Amount: valid digits · negative · zero · empty · letters · letters mixed into digits · exponent |
| **Boundary value analysis** | The value on each limit and the nearest value past it, one parameter at a time. Every limit is enforced by one shared validator, so the comparison is proven at a few parameters, not repeated at all of them. | API principal 999 / 1,000 and 10,00,00,000 / 10,00,00,001 · tenure 1, 480 and 481 months · rate 50 / 50.01 · page 0 / 1 and 10,000 / 10,001 · page size 0, 100 / 101 · search 1 / 2 and 50 / 51 characters · rate 0% (a real product) · every maximum at once (₹10 crore, 50%, 480 months), where float error peaks |
| **Error guessing** | A checklist of things people really type or paste, and things that break parsers. | `--5`, `1e6`, `+100000`, `8,5`, `25.00.000`, 26-digit numbers, `100000.555` (fractions of a paisa), `2023-02-29`, `--amount`, `__proto__` |
| **Decision tables** | Combinations whose rules interact. | Product × EMI scheme: the advance formula applies to Car Loan only, and the option should exist only there |
| **State transitions** | The input's state across events, not just its final value. | Tenure Yr → Mo → Yr keeps the loan · Report page 1 → past-the-end → "Go to page 12" · Back and Reset keep the URL and the form in step |
| **Event coverage** | Inputs committed in more than one way. | Tab (blur) vs **Enter** (change without blur). On emicalculator.net, only Enter leaves `-2383434` in the box next to a positive plan |
| **Property-based testing** | Inputs drawn from the whole valid domain, checked against the oracle. | 200 random loans, below |
| **Security probes** (OWASP WSTG) | Hostile input at every place the app reflects it, and the server's own hardening. | Mapped by test ID, below |
| **Mutation testing** | Realistic bugs, written by hand and planted one at a time, to prove the suite notices each. | 67 hand-written mutants, below |

## Expected behaviour for invalid input

The brief does not specify validation, so this repo uses one rule, applied the same way everywhere:

> **Refuse the entry, or calculate with exactly what the box shows. Never quietly calculate with something else.**

"Refuse" means a visible message, or the box restored with the result unchanged. A box showing `-2383434` beside a plan for +₹23,83,434 breaks the rule. So does a box showing `0` beside a plan where the user typed `abc`. The failing test names the amount the site actually used, by solving the EMI formula for the principal.

## How each result is judged

- **Independent oracle.** Expected numbers come from [`framework/oracles/emi.ts`](../framework/oracles/emi.ts) and [`loan-book.ts`](../framework/oracles/loan-book.ts), which never import app code. Box values are read with *strict* parsers (`strictAmount`, `strictRate`, `strictTenure`) that return `null` for a sign, letters, exponent notation or non-ASCII digits, so the oracle cannot repeat the site's own mistake of reading `-2383434` as 2383434.
- **The oracle never reads its expectation from the response.** The API returns an `inputs` block echoing what it understood. The expected figures are computed from the *request* (amount, rate, tenure and unit, start month, defaulting to the current month), and the echo is itself asserted equal to the request. An API that misread years as months, or started the schedule a month late, would otherwise agree with an oracle fed its own echo (mutants E09–E11).
- **Money tolerances are measured, not chosen.** The API's EMI and totals come from a closed-form formula and are checked **to the paisa**: across 5,005 loans the worst gap to the oracle is ₹0.005, which is rounding. Each loan's `emi` field in the list and by-id responses is compared with the oracle's EMI rounded to the paisa (measured worst gap before rounding: ₹0.0049). The summary's monthly EMI inflow is checked to the paisa too, summing each loan's EMI as quoted. Schedule rows compound through (1+r)^n, so they are checked within max(₹1, 2 × 10⁻⁷ × principal). The final balance is not a float comparison: a repaid loan ends at exactly ₹0.00. At the ₹10 crore / 50% / 480-month corner, an exact `Decimal` computation puts the app ₹7.07 above the true 2064 balance and the oracle ₹3.31 below. Both are float64 drift, not a bug in either.
- **Screens are read back strictly.** UI figures show whole rupees, so every rupee figure, the dashboard's EMI inflow included, is checked within ₹0.51 (display rounding plus the app's paisa rounding); truncating instead of rounding fails 29 scenarios (mutant U05). Dates (`24 Sept 2025`) and tenures (`7 yr 6 mo`) are parsed back into data by strict readers in [`section-a/loanlens-ui/display.ts`](../section-a/loanlens-ui/display.ts) and compared with the loan book. Bars are checked twice on all four bar charts: the value each segment carries, and the height it is drawn at, which must be the same pixels per unit for every segment of every bar (within 1 px). No seeded loan has a part-year tenure, so one scenario stubs a 90-month tenure into LN-1001's mock data as the browser loads it, to reach the "7 yr 6 mo" form; it is the suite's only stubbed response.
- **Measure before asserting.** Each external behaviour was probed on the live target first ([`emicalculator-findings.md`](../section-b/emicalculator/FINDINGS.md), [`jsonplaceholder-findings.md`](../section-a/jsonplaceholder/FINDINGS.md)). The assertions encode the rule above, not the observed behaviour.
- **Known defects stay red.** A failing row is tagged `@known-defect` and written up; the assertion is not loosened. The section runners (`npm run test:section-a`, `test:section-b`) exit 1 only on untagged failures. `retryTagFilter` keeps a known defect from being retried into a flaky-looking pass.

## Property-based check (API)

Hand-picked rows only test the points someone thought of. [`emi.feature`](../section-b/loanlens-api/features/emi.feature) also draws **200 loans** from the whole valid domain with a seeded generator (seed `20261007`, no extra dependency):

- principal ₹1,000 to ₹10 crore, log-uniform so small and large loans are equally likely, with paise;
- rate 0 to 50% with 2 decimals, and exactly 0% one draw in twenty;
- 1 to 480 months, sent in years half the time when the months make a whole quarter-year (exact in binary);
- a start month from 2020 to 2035.

For each loan the API must agree with the oracle on the EMI and totals (to the paisa), the echoed inputs, the calendar years and payment counts of the schedule, every row's principal, interest, total and closing balance, a total principal repaid equal to the loan, and a final balance of exactly zero. A failure prints the exact request to replay.

The pinned seed keeps CI repeatable. `PBT_SEED=<n>` or `PBT_SEED=random` draws a different sample and attaches the seed it used; 11 random seeds (2,200 more loans) all passed. There is no shrinking: a failure names the request that failed, not a minimal one.

## Security testing

Every probe runs against LoanLens only. IDs are from the [OWASP WSTG checklist](https://github.com/OWASP/wstg/blob/master/checklists/checklist.md) on its `master` branch, which numbers input tests `INJT`, and the [OWASP API Security Top 10 (2023)](https://owasp.org/API-Security/editions/2023/en/0x11-t10/).

| ID | Risk | Test | Result |
|---|---|---|---|
| WSTG-INJT-01, WSTG-CLNT-01 | Reflected and DOM-based XSS | `<img src=x onerror=alert(1)>` in the three places the UI echoes the URL: the report's search box, its page note, and the loan-not-found message. Four checks: the text is shown literally; parsing the page's HTML builds no element from it; no dialog opens; the CSP blocked nothing. The last check means a pass cannot come from the CSP stopping an attack the app let through. | Pass |
| WSTG-CONF-12 | Content-Security-Policy | `default-src`, `script-src`, `object-src` and `frame-ancestors`, each compared exactly (so `'unsafe-inline'` added to `script-src` fails), on `/` and on the single-page fallback `/reports`. Every UI scenario that renders a page (52 of 56) also fails if the CSP blocks anything or the page throws an uncaught error, so each doubles as a check that the app still runs under the policy. The other 4 send requests without a page. | **Fixed:** no CSP was sent |
| WSTG-CLNT-09 | Clickjacking | `frame-ancestors 'none'`, as above. | **Fixed** |
| WSTG-CONF-14 | Other security headers | `X-Content-Type-Options: nosniff` on pages and on a 400 that repeats the caller's input; `Referrer-Policy: no-referrer`. | **Fixed:** neither was sent |
| WSTG-INFO-08 | Framework fingerprinting | No `X-Powered-By: Express` header. | Pass |
| WSTG-CONF-06 | HTTP methods | `POST` to the API and to a page gets a JSON 405 with `Allow: GET, HEAD`. `PUT`, `PATCH`, `DELETE`, `OPTIONS` and `TRACE` to `/api/loans` got the same 405 when tried once by hand; one middleware refuses them all, so one method is automated. | **Fixed:** pages answered `POST /` with Express's HTML "Cannot POST /" |
| WSTG-ATHN-06 | Browser cache weakness | API responses carry `Cache-Control: no-store`. | **Fixed:** they were cacheable |
| WSTG-ATHZ-01 | Path traversal | `/..%2f..%2fpackage.json` returns the app's own page, not the file. Three more encodings (`%2e%2e/`, under `/assets/`, a raw `../`) behaved the same when tried once by hand. | Pass |
| WSTG-CLNT-07 | CORS | A request from `https://attacker.example` gets no `Access-Control-Allow-Origin`. | Pass |
| WSTG-INJT-04 | HTTP parameter pollution | A single-value parameter given twice (`principal`) is a 400 `duplicate_parameter`, not "first value wins". List parameters are merged by design: `type=home&type=car` means both types. | Pass |
| WSTG-INJT-22 | Allow-list bypass through inherited names (the prototype-pollution vector) | `?__proto__=x` is a 400 `unknown_parameter`. Nothing was polluted: the value was ignored, but the allow-list let it through. | **Fixed:** it returned 200, because the check used `key in schema`, which is true for inherited names |
| WSTG-ERRH-01, ERRH-02 | Error handling | `/api/loans/%E0%A4%A` (broken percent-encoding) is a 400 `MALFORMED_URL`. Unknown `/api` routes get a JSON 404. In the UI, `/loans/%E0%A4%A` shows "not a valid loan ID" instead of crashing. The 500 handler sends a code and a fixed message, never a stack; that is known from reading the code, because no test input reaches it. | **Fixed:** the API returned 500, and the UI threw `URIError` while building the page title |
| API4 | Unrestricted resource consumption | Page size 101, page 10,001, a 51-character search, and 51 query parameters (50 are accepted): all 400. | **Partial.** The parameter cap is new (Express parses up to 1,000); there is no rate limiting |
| API8 | Security misconfiguration | The header, CORS and method rows above. | Fixed as listed |

LoanLens stores loans in a JSON file and searches with a literal substring match, so there is no SQL to inject. One row with regular-expression characters (`.*`) proves the match is literal; SQL and HTML search strings were dropped as the same partition.

## Mutation check: proof that the tests can fail

`npm run test:mutation` ([`scripts/mutation-check.mjs`](../scripts/mutation-check.mjs)) copies the repo to a temporary folder, runs a green baseline, then plants one realistic bug at a time and runs the suite that should catch it. Source files are never modified; the only files it writes in the repo are the two section summaries, [`section-a/reports/mutation/SUMMARY.md`](../section-a/reports/mutation/SUMMARY.md) and [`section-b/reports/mutation/SUMMARY.md`](../section-b/reports/mutation/SUMMARY.md). The mutants are written by hand, one per bug I would expect a person to make in that line, not generated by a tool. Each belongs to the section whose code it breaks: Section A's 18 are planted in the web app (its server, its in-browser data layer and its UI) and must be caught by the UI suite; Section B's 49 are planted in the API and must be caught by the API suite. `npm run test:mutation -- --section a` runs one section.

A mutant counts as **killed** only if the suite ran to completion with the baseline's scenario count and a step or an After-hook assertion failed. A run that broke in a Before hook (the app did not start, say), or that ran a different number of scenarios, is reported as an **error**, not a kill. The script exits 1 if any mutant survives or errors.

| Section | Area | Mutants | Examples of the planted bug |
|---|---|---|---|
| B | Query-parameter validation (`section-b/api/lib/query.ts`) | 16 | `Number()` or `parseFloat()` instead of a strict pattern, a pattern not anchored at the end, `Math.abs` on input (emicalculator.net's EC-01), off-by-one minimum and maximum, the paisa limit dropped, `key in schema` (lets `__proto__` through), first-value-wins on a repeated parameter, `2023-02-29` accepted |
| B | EMI maths and route (`lib/emi.ts`, `routes/emi.ts`) | 11 | a 360-day year, payments grouped into the wrong calendar year, no 0% special case, the last instalment not adjusted, totals rounded to whole rupees, the tenure message printing raw floating point, years read as months, the default start month off by one (`getMonth()` is zero-based), the start month echoed without zero padding |
| B | Loans, search and summary (`routes/loans.ts`) | 14 | case-sensitive search, search text treated as a regex, an exclusive minimum amount, minimum rate or end date, each loan's EMI truncated to the paisa, EMI inflow counting closed loans or rounded to whole rupees, divide-by-zero on an empty summary, an unanchored loan-id pattern |
| B | API server (`app.ts`, `lib/errors.ts`) | 8 | a city left out of `/api/meta`, `nosniff` removed, CORS opened to every origin, write methods reaching the router, `X-Powered-By` back, `no-store` removed, no query-parameter cap, broken percent-encoding reaching the 500 handler |
| A | Web server (`section-a/app/server.ts`) | 3 | `frame-ancestors` removed, `'unsafe-inline'` added to `script-src`, pages answering write methods |
| A | In-browser data layer (`section-a/app/src/data`) | 6 | a 360-day year, the paisa limit dropped, EMI inflow counting closed loans, case-sensitive search, the city filter ignored, sort direction ignored |
| A | UI (pages, `lib/format.ts`, `BarChart.tsx`, `App.tsx`) | 9 | `--5` ignored, `1e6` read as a number, `?page=1.5` treated as a page, the loan id from the URL rendered as HTML, rupees truncated instead of rounded, dates formatted in a US time zone, stacked bar segments drawn from the axis instead of the segment below, tenure shown without its remaining months, a malformed URL escape crashing the page title |

**Result (2026-10-07, all 67 in one run, 16 min 44 s): 67 killed, 0 equivalent, 0 survived, 0 errored**: Section A 18 of 18, Section B 49 of 49. The summary lists, for each mutant, the scenarios that caught it.

Six results changed the suite rather than the code:
- **U08, the tenure label without its remaining months ("7 yr" for 90 months), had no scenario that could reach it.** None of the 120 seeded loans has a part-year tenure, so no screen rendered that branch. I first marked it "equivalent"; a reviewer called that a relabel, which it was. A loan-detail scenario now stubs a 90-month tenure into the loan's mock data and reads the label back, and U08 fails it.
- **D02, the paisa limit dropped from Section A's data layer, survived.** Before the sections were split, the web app used the API, the rule lived only there, and the UI row for it (`2500000.555`) had been cut as a duplicate of the API's. Once the web app carried its own copy of the rules, nothing in Section A could catch it. The row is back as `100000.555`.
- **L14 and S11 were added with two new checks.** Each loan's `emi` field had been compared within ₹0.05, which a truncated paisa (L14) passes; it is now compared to the paisa. The summary's EMI inflow would also have caught L14. `/api/meta` had no scenario at all, so a city missing from the filter list (S11) went unnoticed.
- **E08, totals rounded to whole rupees, first survived.** All money was compared within ₹1, which hid it. Measuring showed the EMI and totals agree with the oracle to ₹0.005, so they are now checked to the paisa, and the mutant fails 10 scenarios.
- **E07, the last instalment not adjusted, was first marked "equivalent"**, on the reasoning that a level EMI already clears the balance. Measured, that is false: without the adjustment the ₹10 crore / 50% / 480-month loan ends with ₹11.55 still owed, and 1.2% of 200,000 random loans end with at least half a paisa owed. The final balance was being compared with the drift tolerance (₹20 at that size). It is now asserted to be exactly ₹0.00, and the corner loan is a boundary row, so the mutant is caught on every run, not only when the random draw happens to hit it.

## What was cut and why

The suites went from 139 → 106 (API), 69 → 57 (UI), 53 → 38 (emicalculator), 51 → 36 (JSONPlaceholder) and 40 → 6 (SQL) scenarios. The new counts include rows added during review: the corner loan, the 50/51-parameter cap and `/api/meta` in the API; the page-level security rows, the malformed loan URL, the part-year tenure and the restored paisa row in the UI. Each row below was removed because the row named in the second column fails for the same cause.

| Removed | Still caught by |
|---|---|
| **API:** request with no parameters at all | "Missing required parameters are all reported" |
| **API:** principal `1,00,000`, `10%`, `0x186A0`, `Infinity`, `NaN`, Devanagari digits, `ten-lakh` | `1e5`, `+100000`, `100000.555`, `8,5`: one strict number pattern rejects them all, and any parser that lets text through also lets one of these through |
| **API:** 26-digit principal | "principal above maximum" (100000001) |
| **API:** tenure above 40 years, under one month, negative in months | The tenure-message outline (41 years, 481 months, 0.1 years) and "negative tenure in years"; months and years share one range check |
| **API:** negative page, 20-digit page, page as text (`two`); rate as text; unknown status; a scalar parameter twice | page 0, page 10,001, page `1.5` (a parser that rejects `1.5` rejects `two`; `parseInt` accepts `1.5`); unknown loan type; principal given twice |
| **API:** SQL, HTML and emoji search; "highest rate first in one city"; ascending/descending amount sorts; a combined "filters are honoured" scenario | The `.*` literal-search row; the sort outline and filter rows, each of which already checks every returned loan |
| **API:** four write methods; summary's paging outline; loan id just past the last; injection-looking id; malformed id `abc` | One `POST` (one middleware refuses them all); `page=2` on the summary; `LN-9999`; lower-case `ln-1001` and five-digit `LN-10011`, which catch a case-insensitive and an unanchored id pattern |
| **API:** search for `sharma` | `SHARMA`: a case-insensitive match finds the same loans, and a case-sensitive one fails it |
| **UI:** zero, negative and 0.01-year tenure; amount 500; `1e1`; a lone `-` | Each field's out-of-range row (one range check per field); `1e6` (same check); `--5` (same `badInput` path) |
| **UI:** `abc`, `!@#$%`, Devanagari typed into the amount box | Nothing to test in the app: Chromium's number box refuses every key, so this tested the browser. The resulting empty box is the "left empty" row |
| **UI:** report rows for "car loans in Mumbai over ₹10 lakh", `?page=-3`, search for HTML/SQL text; three extra loan-detail ids | The filter outline; `?page=0`; the XSS sink outline; loan LN-1001 |
| **emicalculator:** international grouping; amount empty, symbols, Devanagari, `12abc34` with Enter, `1e6`, HTML; rate empty, `1e1`, `8.5abc`; tenure empty, 0.01 years, -24 and 0 months; the 2.5 → 30 month round trip | The row kept for each defect (EC-01 to EC-09). The dropped inputs are still listed in the findings as measured once |
| **JSONPlaceholder:** 10,000- and 1,000,000-character titles in validation; 1 MB body; control characters; zero-width and bidi in robustness; `{}` and a form body in validation | 256 characters (validation) and 1,000,000 (robustness); NUL; bidi (validation); missing fields. Listed in the findings as measured once |
| **SQL:** 34 per-row scenarios ("Reported", "Not reported", "One row per streak"), each repeating a row of the exact-match check | The hand-worked tables in each feature's main scenario. The near misses are still checked to exist in the seed, which the per-row scenarios did too |

Two rows were put back after the mutation check showed each was the only killer: `?page=1.5` in the Reports UI is the sole test that a decimal page number is not treated as a page (mutant U03), and `100000.555` in the calculator the sole test of the paisa limit in Section A's own data layer (mutant D02).

## Coverage by surface

### emicalculator.net (Section B3), 38 scenarios

| Box | Valid partitions and boundaries (pass) | Invalid partitions (all `@known-defect`) |
|---|---|---|
| Loan amount | plain digits, Indian grouping, `₹` prefix, ₹1, above the ₹20 lakh slider maximum | negative (Tab and Enter), 0, letters, letters between digits, `25.00.000`, 26 digits |
| Interest rate | 0.01%, 4% (below the slider), 25% (above), `8.5%` | **0%** (valid, but replaced with 9%), negative, letters, `8,5` |
| Tenure | 1, 2.5 and 10 years; 1 and 30 months | negative, 0 and letters in years; 2.5 months |
| Rules | EMI in Advance = arrears ÷ (1 + r) on Car Loan, and absent on Home and Personal; Yr↔Mo round trips | — |

### LoanLens calculator UI (A1/A2)

The UI uses `type="number"` inputs, so the browser filters keystrokes before the app sees them. The tests type key by key (`pressSequentially`) where that matters; `fill()` cannot produce what a person can.

| Condition | Result |
|---|---|
| Negative amount, negative rate, 50 years | The API's refusal on the right field, in that field's words. The tenure message names the unit: "…between 1 and 480 (got 600 months)". **Fixed:** it used to say "between 1 and 480" for years. |
| `1e6` (allowed by a number box) | "…must be written in plain digits, for example 2500000." **Fixed:** it used to say "must be a number", which `1e6` is. |
| `--5` (the browser keeps the text but cannot read it) | "Loan amount must be a number." **Fixed:** it used to say "Enter a loan amount". React's `onChange` never fires for this, so the app reads `validity.badInput` on the native `input` event. |
| `12abc34` | The browser drops the letters and the box shows `1234`. The results match ₹1,234, so the box and the plan agree. |

### LoanLens Reports UI

| Condition | Result |
|---|---|
| `?page=9999` | "There is no page 9,999. This report has 12 pages." with a **Go to page 12** button. **Fixed:** it used to read "Showing 99981–120 of 120 loans". |
| `?page=abc`, `0`, `1.5` | Page 1, with a note that names the bad value. **Fixed:** the bad value used to be ignored silently. |
| Markup in `?q=` or `?page=` | Shown as text; see Security testing. |

### LoanLens API (B1/B2), 106 scenarios

Every invalid row asserts the status, the JSON Schema of the error and the issue code for the named parameter. Hostile numbers: negative, `+100000`, `1e5`, `100000.555`, a parameter given twice, `8,5`. Dates: `2023-02-29`, month 13 (the only bad value for `disbursedTo`, which has its own schema entry), `01/02/2024`. Lists: one bad value in `type=home,boat`. Sort: `--amount`. Names: `__proto__`, and `pagesize`, which differs from `pageSize` only in case and catches a parser that folds case.

Every range filter is tested at an edge that equals a real loan's value: `minRate=8.95` (six loans), `maxRate=10` (LN-1041), `disbursedFrom=2024-01-01` (LN-1094), `disbursedTo=2024-12-12`, and `minAmount=maxAmount=1560000` (LN-1001). An inclusive bound turned exclusive changes `meta.total` (mutants L03, L12, L13).

**Deliberate, not a defect:** surrounding whitespace in a query value is trimmed (`principal=%20100000` is 1,00,000).
