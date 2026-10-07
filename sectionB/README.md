# Section B: API development + API automation

Section B of the brief (B1–B4), as a project of its own. It has its own `package.json` and lockfile, test framework, SQL, self-healing engine and reports. Nothing here reads or imports anything outside this folder, so it can be installed, run and graded without Section A.

Its API, LoanLens, lives in [`api/`](api) and returns data from its own mock JSON file. It serves no web pages.

## Run it

Requirements: Node 22.12+, 24 or 26+ and npm. These are the Node lines Cucumber 13 supports; CI uses 22, and this was developed on 26.7.

```bash
cd sectionB
npm ci
npx playwright install chromium     # the browser Playwright drives (for emicalculator.net)
npm test
```

`npm test` does the following:
- starts the API;
- runs every suite;
- writes [`reports/SUMMARY.md`](reports/SUMMARY.md), one row per suite.

It exits 1 only on an *unexpected* failure. The red rows it expects are explained in [Findings](#findings).

Nothing else needs installing. The SQL runs on an embedded PostgreSQL (PGlite). The emicalculator.net suites need internet access.

| Command | What it runs |
|---|---|
| `npm test` | B2 (LoanLens API), B3 (emicalculator.net), B4 (SQL) and the self-healing exercise. Writes [`reports/`](reports). |
| `npm test -- loanlens-api sql` | Only the named suites, still into `reports/`. The suites are `loanlens-api`, `emicalculator`, `sql`, `self-healing` and `self-healing-healed`. |
| `npm run test:loanlens-api`, `test:emicalculator`, `test:sql`, `test:self-healing` | One suite on its own, into the git-ignored `test-results/`. Extra Cucumber arguments pass through, for example `node scripts/run-suite.mjs loanlens-api --name "Sorting"`. |
| `npm run test:mutation [-- E09 L03 …]` | Plants 49 hand-written bugs in a copy of the API, one at a time, and checks that the API suite catches each. Writes [`reports/mutation/SUMMARY.md`](reports/mutation/SUMMARY.md). |
| `npm run heal [-- --provider heuristic\|claude-cli\|anthropic] [--mode suggest]` | The 5 broken locators with healing on. Writes validated patches. |
| `npm start` | The API itself, on http://localhost:5056/api. `npm run dev` restarts it on edits. |
| `npm run data:generate` | Regenerates the mock data from its fixed seed. |
| `npm run typecheck` | Runs `tsc --noEmit` over the API, the tests, the SQL and the healer. |

Try the API by hand once `npm start` is running:

```bash
curl 'http://localhost:5056/api/loans?type=home,car&status=active&sort=-amount&pageSize=5'
curl 'http://localhost:5056/api/loans/LN-1001'
curl 'http://localhost:5056/api/loans/summary?city=Pune'
curl 'http://localhost:5056/api/emi?principal=2500000&rate=10&tenure=10'
curl 'http://localhost:5056/api/loans?pageSize=101'        # 400, with the reason in details[]
```

## Results

Last run: `npm test`, 2026-10-07, macOS, Node 26.7. **0 unexpected failures.** Mutation check (`npm run test:mutation`): **49 of 49 hand-written bugs caught**.

| Suite | Brief | Scenarios | Passed | Failed, expected | Notes |
|---|---|---|---|---|---|
| loanlens-api | B1/B2 | 106 | 106 | 0 | 583 Gherkin steps, including 200 random loans checked against my own amortisation. |
| emicalculator | B3 | 38 | 23 | 15 | Live site. `@known-defect`: the site silently recalculates with something other than what the box shows (negative signs dropped, letters stripped, `8,5` read as 85%). |
| sql | B4 | 6 | 6 | 0 | PostgreSQL 18 via PGlite. Each query is checked against a table worked out by hand and against an independent TypeScript oracle. |
| self-healing (healing off) | AI exercise | 5 | 0 | 5 | `@broken-locator`: broken on purpose. |
| self-healing-healed (`npm run heal`) | AI exercise | 5 | 4 | 1 | 4 healed by Claude Sonnet via `claude -p` ($0.022 for the run). For the e-mail button the page does not have, it returned no candidate, so the scenario stays red (`@unhealable`). |

Each suite folder under [`reports/`](reports) holds the Cucumber HTML report, JSON, JUnit XML, the console log and screenshots.

## Where each requirement lives

| Brief | Implementation | Tests |
|---|---|---|
| **B1** Own API with mock JSON, query params and error codes | [`api/`](api): Express 5 over 120 seeded loans in [`api/data/loans.json`](api/data/loans.json), with no database. Endpoints: `/api/loans` (10 filters, sort, paging), `/api/loans/:id`, `/api/loans/summary`, `/api/emi`, `/api/meta` and `/api/health`. Every parameter is declared once, in [`lib/query.ts`](api/lib/query.ts). Errors are 400/404/405 with a structured `details[]`. | — |
| **B2** API tests: happy paths, invalid params, status and shape | [`loanlens-api/`](loanlens-api): [`features/`](loanlens-api/features), [`steps/`](loanlens-api/steps), [`api/`](loanlens-api/api) (client and JSON Schemas) | 106 scenarios, with JSON Schema checks (ajv). Expectations are computed from the request, never from the response. They cover the value on and just past each limit (the amount, rate and date filter edges sit exactly on a seeded loan); hostile numbers (`+100000`, `1e5`, `8,5`, fractions of a paisa); parameter pollution; `__proto__`; a query-parameter cap; the filter vocabulary; security headers; CORS; write methods; and malformed URLs. They also check 200 random loans against my own amortisation (the seed is pinned; `PBT_SEED=random` varies it). |
| **B3** emicalculator.net TC1 (pie, scenarios A and B) and TC2 (sliders, calendar, bar count, tooltips) | [`emicalculator/`](emicalculator): [`features/`](emicalculator/features), [`steps/`](emicalculator/steps), [`pages/`](emicalculator/pages) (a Page Object and component objects: Slider, PieChart, ColumnChart, MonthPicker) | The 3 brief scenarios, plus 35 more: valid formats and boundaries, one row per invalid partition that fails, the EMI-scheme rules, and Yr/Mo switching. Results are compared within ₹1 of my own EMI and amortisation. The site's input defects: [`emicalculator/FINDINGS.md`](emicalculator/FINDINGS.md). |
| **B4** SQL: round-trip transfers, IPL 30+ streaks, schema, output screenshots | [`sql/`](sql) (see [`sql/README.md`](sql/README.md)) | 6 scenarios on PostgreSQL 18 (in-process PGlite). For each query: the exact result against a hand-worked table and an independent oracle, including near misses that must exist in the seed and stay out of the result; a deliberately wrong query that must be rejected; and the output screenshot. Screenshots: [`sql/results`](sql/results). |
| Framework: feature, step and page files, environment config, resilient locators | [`framework/`](framework) plus the per-suite folders above | URLs and timeouts come from `config/env/.env.<TEST_ENV>`; see [Configuration](#configuration). |
| Self-healing: 3–5 broken locators plus an explanation | The broken locators: [`self-healing/pages/LegacyEmiLocators.ts`](self-healing/pages/LegacyEmiLocators.ts) and [`self-healing/features`](self-healing/features). The healer: [`self-healing/`](self-healing). The explanation: [`docs/SELF_HEALING.md`](docs/SELF_HEALING.md). | 5 locators on emicalculator.net, written wrong on purpose: a wrong id, wrong link text, an ambiguous name pattern, a positional locator that finds the comment form's Name box, and a feature the page does not have. A working POC (Claude via `claude -p`, the Messages API, or an offline heuristic), with validation gates and reviewable patches. Every value typed through a healed locator is read back through the healthy page object, and the EMI is checked against my own amortisation, so a wrong heal still fails. |
| Claude Code reflection | [Root README](../README.md#claude-code-reflection) | — |

## Configuration

Nothing is hardcoded. URLs, browser, timeouts and artifacts come from `config/env/.env.<TEST_ENV>`. `local` is the default, and CI uses `TEST_ENV=ci`. A git-ignored `.env.<TEST_ENV>.local` file overrides it, and real environment variables override both.

| Key | Purpose |
|---|---|
| `API_PORT`, `API_BASE_URL` | Where the API runs (default :5056/api). |
| `APP_AUTOSTART` | Whether a run starts the API when nothing answers at its URL. |
| `EMI_CALCULATOR_URL` | The external site under test. |
| `BROWSER` (chromium/firefox/webkit), `BROWSER_CHANNEL`, `HEADLESS`, `SLOW_MO`, `VIEWPORT_*` | Browser. |
| `DEFAULT_TIMEOUT_MS`, `STEP_TIMEOUT_MS` | Timeouts. |
| `TRACE` (`retain-on-failure`), `SCREENSHOTS` (`on-failure`) | Artifacts. A failure leaves a screenshot in the report and a Playwright trace in `<reports>/<suite>/traces/`. |
| `REPORTS_DIR` | Where suites write (`test-results` by default; `npm test` uses `reports`). |
| `SELF_HEAL` (off/suggest/heal), `HEAL_PROVIDER`, `HEAL_MODEL` | Self-healing. |
| `PBT_SEED` | The property-based check's seed (pinned by default; `random` draws a new one). |

## Design decisions

- **Independent oracles.** A test that compares the app with the app's own formula proves nothing.
  - [`framework/oracles/emi.ts`](framework/oracles/emi.ts) and [`framework/oracles/loan-book.ts`](framework/oracles/loan-book.ts) re-implement the EMI, the amortisation, filtering, sorting and the summaries. They never import app code.
  - The same EMI oracle checks the LoanLens API *and* emicalculator.net. The loan-book oracle reads the same mock data file the API reads.
- **The oracle never reads its expectation from the response.** Expected figures are computed from the *request*. The API's echo of what it understood is itself asserted equal to the request.
- **Locators.** Role and accessible name come first, then label. Outside the deliberately broken legacy page object there is no XPath, no `waitForTimeout` and no `force: true`. emicalculator.net has no ARIA on its sliders or charts, so there the component objects anchor on each widget's stable id and on Highcharts' documented class names, and read only what a user sees.
- **The sliders are dragged, not set.** TC2 asks for the sliders, so `Slider.setTo` drags the handle to the value's position on the track. It then nudges the handle with the arrow keys until the bound box shows the exact target. The report records each slider's start value, so a slider that was already at the target cannot pass unexercised.
- **Evidence.** Every scenario that checks a number attaches the measured and the expected values, plus screenshots. A green run therefore shows *what* was compared, not just that something passed.
- **One app server per run.** `scripts/run-suite.mjs` starts the API once, before the parallel Cucumber workers spawn. If each worker started one, they would race for the port (see the reflection in the root README).
- **Each rule is tested once, where it lives.** The validation rules belong to the API, so the API suite owns the partitions and boundaries. A row that fails only when another row fails too was cut ([what was cut and why](docs/TEST_DESIGN.md#what-was-cut-and-why)).
- **The tests are proven able to fail.** `npm run test:mutation` plants 49 realistic bugs, one at a time. Examples: an off-by-one limit, `Math.abs` on input, first-value-wins parameters, years read as months, a missing header, and totals rounded to whole rupees.
- **Expected failures are tagged, not hidden.** emicalculator.net's defects are `@known-defect`, and the broken locators are `@broken-locator`. `npm test` exits 1 only on untagged failures, so CI stays meaningful without weakening a single assertion.

How the test cases were chosen is in [`docs/TEST_DESIGN.md`](docs/TEST_DESIGN.md): which suite owns which risk, the techniques (partitions, boundaries, error guessing, decision tables, state transitions), the security tests mapped to OWASP IDs, the property-based check, and the mutation check.

## Findings

### emicalculator.net input handling (B3)

Full write-up, with a by-hand reproduction and the cause in the site's script: [`emicalculator/FINDINGS.md`](emicalculator/FINDINGS.md).

The site never refuses an entry. It rewrites any invalid entry into some number and shows a plan for that number:
- **EC-01 (High).** Type `-2383434` and press Enter. The box keeps the minus sign, but the EMI shown (₹1,08,341) is for **+**₹23,83,434.
- **EC-03 (High).** `12abc34` is calculated as ₹1,234, and `1e6` as ₹16.
- **EC-07 (High).** A rate of `8,5` becomes **85%**, so the EMI on ₹50 lakh jumps from ₹43,391 to ₹3,54,167.
- **EC-06 (Medium).** A 0% rate (no-cost EMI) is replaced with 9%.
- **EC-02, EC-05, EC-09 (Medium).** Zero, empty, letters and negative values become ₹0, positive values, or 1 year.
- **EC-04 and EC-08 (Low).** `NaN` is shown in the box, and 26-digit amounts lose precision.

15 `@known-defect` scenarios cover these: one per invalid partition that fails, plus Tab and Enter for the negative amount, where the site behaves differently. The 23 others pass, including the valid formats the site does handle (`15,00,000`, `₹15,00,000`, `8.5%`) and its EMI-in-advance maths.

### emicalculator.net: the brief's test cases (B3)

Every figure matched my own calculation within the site's rupee rounding.
- **TC1:** EMIs ₹33,038 and ₹46,351; pie splits 63.1/36.9% and 59.9/40.1%.
- **TC2:** all 6 calendar-year bars and both tooltip parts of each bar, for a schedule starting in Mar 2027.

Two behaviours of the site shaped the page objects:
- **Selected pie slice.** The interest slice is drawn *selected*, which suppresses Highcharts' hover class, so the pie waits for its tooltip text to change instead.
- **Covered columns.** The Balance spline's markers cover parts of the columns, so a forced hover at a column's centre can land on a marker and read the previous tooltip. The chart object hovers only at a point where the column is the topmost element.

### LoanLens API defects found by the same techniques, and fixed

| Found | Now |
|---|---|
| `100000.555` (fractions of a paisa) was accepted | "must have at most 2 decimal places" |
| `/api/loans/%E0%A4%A` (broken percent-encoding) returned **500** | 400 `MALFORMED_URL` |
| `?__proto__=x` returned 200, where any other unknown parameter is a 400: the check used `key in schema`, which is true for inherited names | 400 `unknown_parameter` |
| No `nosniff` or `Referrer-Policy` | `nosniff`, `no-referrer` |
| My own first fix of the tenure message printed `got 1.2000000000000002 months` for 0.1 years | `got 1.2 months` |
| Responses were cacheable, and any number of query parameters was parsed (Express's default limit is 1,000) | `Cache-Control: no-store`; more than 50 parameters is a 400 `TOO_MANY_PARAMETERS` |

Each fix was reverted on purpose to confirm that its new scenarios fail without it, and `npm run test:mutation` repeats that revert automatically for every row above.

### LoanLens precision (B1/B2)

- **What:** at the extreme corner (₹10 crore, 50% p.a., 480 months) the API's yearly schedule drifts from the exact result.
- **Measured:** against a 60-digit `Decimal` amortisation, the 2061 closing balance is off by **+₹1.04**. With a January 2026 start, the 2064 balance is off by **+₹7.07**.
- **Cause:** float64 error compounding through `(1+r)^n`.
- **Tests:** EMI and totals are compared to the paisa. Schedule rows, where the error compounds, are compared within max(₹1, 2e-7 × principal).
- **Recommendation:** production lending code should use decimal or integer-paise arithmetic.

## Self-healing locators

[`docs/SELF_HEALING.md`](docs/SELF_HEALING.md) has the full design and the measured results. In short:

- **The broken locators.** There are five on emicalculator.net, each a different kind of rot: a wrong id, wrong link text, an ambiguous name pattern, a positional locator that finds the comment form's Name box instead of the interest rate, and a feature the page does not have. With healing off they fail with a precise diagnosis.
- **What the healer gets.** It sees the declared intent and fingerprint, the failure class, the ARIA snapshot and an element inventory. It answers in a restricted locator vocabulary: never CSS or XPath, and never code.
- **Validation.** Every answer must pass the same gates: unique, visible, matching the fingerprint, and replayed against the oracle-backed assertions. The result is a patch for a person to review. This run produced 4, and every one passes `git apply --check`. The tool never edits source.
- **Evaluation.** The healer's accuracy was measured in Section A, on a page that is the same in every trial. That evaluation found 0 false heals in 84 trials. The engine here is the same code; see section 5 of `SELF_HEALING.md`.

## Folder map

```
api/                  B1: the API. routes/, lib/query.ts (declarative parameter validation), lib/errors.ts,
                      data/loans.json (the mock data), app.ts, index.ts
loanlens-api/         B2: features/, steps/, api/ (client + JSON Schemas)
emicalculator/        B3: features/, steps/, pages/ (Page Object + component objects), FINDINGS.md
sql/                  B4: schema, seed, queries, deliberately wrong queries, oracle, features/, steps/, results/
self-healing/         the healer (runtime, providers, validation, patch writer) and its exercise:
                      features/, steps/, pages/LegacyEmiLocators.ts (5 broken locators)
framework/            World, hooks (browser, tracing, starting the API), config/env.ts, base API client, shared API steps, oracles/
config/env/           .env.local, .env.ci, .env.example
scripts/              run-suite.mjs (one suite), run-all.mjs (npm test + SUMMARY.md), mutation-check.mjs, generate-loans.ts
docs/                 TEST_DESIGN.md, SELF_HEALING.md, self-healing-runs/ (the offline heuristic's saved run)
reports/              results of the last `npm test` and of the mutation check (committed evidence)
```

The Claude Code reflection, which covers both sections, is in the [root README](../README.md#claude-code-reflection).
