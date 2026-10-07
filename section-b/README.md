# Section B: API development + API automation

This folder is Section B of the brief (B1–B4), and can be run and graded without Section A. Its API, LoanLens, lives here in [`api/`](api) and returns data from its own mock JSON file; it serves no web pages and nothing in Section A calls it. The shared parts it does use (the test framework, the SQL and the self-healing engine) are listed under [What else Section B uses](#what-else-section-b-uses).

## Run it

From the repository root:

```bash
npm ci
npx playwright install chromium
npm run test:section-b
```

`test:section-b` starts the API, runs every Section B suite, and writes [`reports/SUMMARY.md`](reports/SUMMARY.md) with one row per suite. It exits 1 only on an *unexpected* failure. The red rows it expects are explained in [Findings](#findings).

| Command | What it runs |
|---|---|
| `npm run test:section-b` | B2, B3, B4 and Section B's self-healing exercise; reports in [`section-b/reports/`](reports) |
| `node scripts/run-all.mjs --section b loanlens-api` | One suite only (`loanlens-api`, `emicalculator`, `sql`, `self-healing`, `self-healing-healed`) |
| `npm run test:mutation -- --section b` | Plants Section B's 49 hand-written bugs in a copy of the API, one at a time, and checks that the API suite catches each; writes [`reports/mutation/SUMMARY.md`](reports/mutation/SUMMARY.md) |
| `npm run start:api` | The API itself, on http://localhost:5056/api (`npm run dev:api` restarts on edits) |

Try the API by hand once `npm run start:api` is running:

```bash
curl 'http://localhost:5056/api/loans?type=home,car&status=active&sort=-amount&pageSize=5'
curl 'http://localhost:5056/api/loans/LN-1001'
curl 'http://localhost:5056/api/loans/summary?city=Pune'
curl 'http://localhost:5056/api/emi?principal=2500000&rate=10&tenure=10'
curl 'http://localhost:5056/api/loans?pageSize=101'        # 400, with the reason in details[]
```

## Results

Last run: `npm run test:section-b`, 2026-10-07, macOS, Node 26.7. **0 unexpected failures.** Mutation check (`npm run test:mutation -- --section b`): **49 of 49 hand-written bugs caught.**

| Suite | Brief | Scenarios | Passed | Failed, expected | Notes |
|---|---|---|---|---|---|
| loanlens-api | B1/B2 | 106 | 106 | 0 | 583 Gherkin steps, including 200 random loans checked against my own amortisation |
| emicalculator | B3 | 38 | 23 | 15 | Live site. `@known-defect`: the site silently recalculates with something other than what the box shows (negative signs dropped, letters stripped, `8,5` read as 85%) |
| sql | B4 | 6 | 6 | 0 | PostgreSQL 18 via PGlite. Each query is checked against a table worked out by hand and an independent TypeScript oracle |
| self-healing (healing off) | AI exercise | 5 | 0 | 5 | `@broken-locator`, broken on purpose |
| self-healing-healed (`npm run heal`) | AI exercise | 5 | 4 | 1 | 4 healed by Claude Sonnet via `claude -p` ($0.248 for the run); for the e-mail button the page does not have, it returned no candidate, so the scenario stays red (`@unhealable`) |

Each suite folder under [`reports/`](reports) holds the Cucumber HTML report, JSON, JUnit XML, the console log and screenshots.

## Where each requirement lives

| Brief | Implementation | Tests |
|---|---|---|
| **B1** Own API with mock JSON, query params and error codes | [`api/`](api): Express 5 over 120 seeded loans in [`api/data/loans.json`](api/data/loans.json), with no database. Endpoints: `/api/loans` (10 filters, sort, paging), `/api/loans/:id`, `/api/loans/summary`, `/api/emi`, `/api/meta` and `/api/health`. Every parameter is declared once in [`lib/query.ts`](api/lib/query.ts); errors are 400/404/405 with a structured `details[]`. | — |
| **B2** API tests: happy paths, invalid params, status and shape | [`loanlens-api/`](loanlens-api): [`features/`](loanlens-api/features), [`steps/`](loanlens-api/steps), [`api/`](loanlens-api/api) (client and JSON Schemas) | 106 scenarios, with JSON Schema checks (ajv) and expectations computed from the request, never from the response: the value on and just past each limit (the amount, rate and date filter edges sit exactly on a seeded loan), hostile numbers (`+100000`, `1e5`, `8,5`, fractions of a paisa), parameter pollution, `__proto__`, a query-parameter cap, the filter vocabulary, security headers, CORS, write methods and malformed URLs, plus 200 random loans checked against my own amortisation (seed pinned; `PBT_SEED=random` varies it). |
| **B3** emicalculator.net TC1 (pie, scenarios A and B) and TC2 (sliders, calendar, bar count, tooltips) | [`emicalculator/`](emicalculator): [`features/`](emicalculator/features), [`steps/`](emicalculator/steps), [`pages/`](emicalculator/pages) (Page Object and component objects: Slider, PieChart, ColumnChart, MonthPicker) | The 3 brief scenarios, plus 35 on valid formats and boundaries, one row per invalid partition that fails, the EMI-scheme rules and Yr/Mo switching. Results are compared within ₹1 of my own EMI and amortisation. The site's input defects: [`emicalculator/FINDINGS.md`](emicalculator/FINDINGS.md). |
| **B4** SQL: round-trip transfers, IPL 30+ streaks, schema, output screenshots | [`sql/`](../sql) (see [`sql/README.md`](../sql/README.md)); the same SQL answers A4 | 6 scenarios on PostgreSQL 18 (in-process PGlite): per query, the exact result against a hand-worked table and an independent oracle (with near misses that must exist in the seed and stay out), a deliberately wrong query that must be rejected, and the output screenshot. Screenshots: [`sql/results`](../sql/results). |
| Framework: feature, step and page files, environment config, resilient locators | [`framework/`](../framework) plus the per-suite folders above | URLs and timeouts come from `config/env/.env.<TEST_ENV>`; see [Configuration](../README.md#configuration). |
| Self-healing: 3–5 broken locators plus an explanation | [`self-healing/pages/LegacyEmiLocators.ts`](self-healing/pages/LegacyEmiLocators.ts), [`self-healing/features`](self-healing/features), the healer in [`../self-healing/`](../self-healing), [`docs/SELF_HEALING.md`](../docs/SELF_HEALING.md) | 5 locators on emicalculator.net written wrong on purpose (a wrong id, wrong link text, an ambiguous name pattern, a positional locator that finds the comment form's Name box, and a feature the page does not have), a working POC (Claude via `claude -p`, the Messages API, or an offline heuristic), validation gates and reviewable patches. Every value typed through a healed locator is read back through the healthy page object and the EMI is checked against my own amortisation, so a wrong heal still fails. |
| Claude Code reflection | [Root README](../README.md#claude-code-reflection) | — |

## What else Section B uses

- **The framework** ([`framework/`](../framework)): World, hooks (browser, tracing, starting the API), configuration, the base API client and the independent oracles. Each Section B suite loads the framework and its own steps only ([`cucumber.js`](../cucumber.js)), so nothing here depends on Section A code. The loan-book oracle reads this API's own copy of the mock data.
- **SQL** ([`sql/`](../sql)) is shared with Section A (A4 and B4 are the same two queries), and runs under `npm run test:section-b` too.
- **The self-healing engine** ([`self-healing/`](../self-healing)): the healer, its providers, validation and patch writer. Section B's exercise (the broken locators, feature and steps) is in [`self-healing/`](self-healing) here, on the B3 page objects; Section A has its own on its web app.
- **The mock data generator** ([`scripts/generate-loans.ts`](../scripts/generate-loans.ts)) writes this API's [`loans.json`](api/data/loans.json) and Section A's copy from the same seed. Nothing here reads Section A's copy.

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

15 `@known-defect` scenarios cover these: one per invalid partition that fails, plus Tab and Enter for the negative amount, where the site behaves differently. The 23 others pass, including the valid formats it does handle (`15,00,000`, `₹15,00,000`, `8.5%`) and its EMI-in-advance maths.

### emicalculator.net: the brief's test cases (B3)

Every figure matched my own calculation within the site's rupee rounding.
- **TC1:** EMIs ₹33,038 and ₹46,351; pie split 63.1/36.9% and 59.9/40.1%.
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

Each fix was reverted on purpose to confirm that its new scenarios fail without it, and `npm run test:mutation -- --section b` repeats that revert automatically for every row above.

### LoanLens precision (B1/B2)

- **What:** at the extreme corner (₹10 crore, 50% p.a., 480 months) the API's yearly schedule drifts from the exact result.
- **Measured:** against a 60-digit `Decimal` amortisation, the 2061 closing balance is off by **+₹1.04** and, with a January 2026 start, the 2064 balance by **+₹7.07**.
- **Cause:** float64 error compounding through `(1+r)^n`.
- **Tests:** EMI and totals are compared to the paisa. Schedule rows, where the error compounds, are compared within max(₹1, 2e-7 × principal).
- **Recommendation:** production lending code should use decimal or integer-paise arithmetic.

## Folder map

```
section-b/
  api/                  B1: the API. routes/, lib/query.ts (declarative parameter validation), lib/errors.ts,
                        data/loans.json (the mock data), app.ts, index.ts
  loanlens-api/         B2: features/, steps/, api/ (client + JSON Schemas)
  emicalculator/        B3: features/, steps/, pages/ (Page Object + component objects), FINDINGS.md
  self-healing/         the AI exercise: features/, steps/, pages/LegacyEmiLocators.ts (5 broken locators)
  reports/              results of the last `npm run test:section-b` and of the Section B mutation check
sql/                    B4 (= A4)               (shared repo root)
self-healing/           the healer engine       (shared)
framework/              World, hooks, config, base API client, oracles (shared)
```
