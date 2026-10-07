# Streamhub QA automation assessment

Both sections of the brief are covered, in one Playwright + Cucumber framework (TypeScript):

- **Section A:** a lending dashboard I built (LoanLens), UI tests for it, JSONPlaceholder robustness tests, and SQL.
- **Section B:** the LoanLens JSON API with API tests, emicalculator.net with Playwright + Cucumber, and the same SQL.
- **Extras:** the AI self-healing exercise with a working proof of concept, and the committed test results.

The brief asks for one section. Each can be graded on its own: [Where each requirement lives](#where-each-requirement-lives) maps every item to its code and its suite. How the test cases were chosen, and how I know they are enough, is in [`docs/TEST_DESIGN.md`](docs/TEST_DESIGN.md): which layer owns which risk, the techniques (partitions, boundaries, error guessing, decision tables, state transitions), security tests mapped to OWASP IDs, a property-based check, and a mutation check.

![LoanLens dashboard](docs/screenshots/dashboard.png)

## Results

Last full run (`npm run test:all`, 2026-10-07, macOS, Node 26.7). **0 unexpected failures.** Mutation check (`npm run test:mutation`, same morning): **61 of 61 hand-written bugs caught.**

| Suite | Brief | Scenarios | Passed | Failed, expected | Notes |
|---|---|---|---|---|---|
| loanlens-api | B1/B2 | 106 | 106 | 0 | 583 Gherkin steps, including 200 random loans checked against my own amortisation |
| loanlens-ui | A1/A2 | 56 | 56 | 0 | 335 Gherkin steps. Every scenario that renders a page (52 of 56) also fails if the page throws or the Content-Security-Policy has to block anything |
| sql | A4/B4 | 6 | 6 | 0 | PostgreSQL 18 via PGlite. Each query is checked against a table worked out by hand and an independent TypeScript oracle |
| jsonplaceholder | A3 | 36 | 16 | 20 | `@known-defect`: 18 invalid inputs not rejected with a 4xx. 2 of them crash the server (500), so they also fail the no-server-error check |
| emicalculator | B3 | 38 | 23 | 15 | live site. `@known-defect`: the site silently recalculates with something other than what the box shows (negative signs dropped, letters stripped, `8,5` read as 85%) |
| self-healing (healing off) | AI exercise | 5 | 0 | 5 | `@broken-locator`, broken on purpose |
| self-healing-healed (`npm run heal`) | AI exercise | 5 | 4 | 1 | 4 healed by Claude Sonnet ($0.021 for the run); the removed feature is correctly refused (`@unhealable`) |

Full per-suite table: [`reports/SUMMARY.md`](reports/SUMMARY.md). Each suite folder under `reports/` holds the Cucumber HTML report, JSON, JUnit XML, the console log and screenshots. The expected failures are deliberate, and each is explained in [Findings](#findings).

## Where each requirement lives

| Brief | Implementation | Tests |
|---|---|---|
| **A1** Web app with a dashboard, a report view and a chart | [`app/web`](app/web/src): React + Vite. The dashboard has KPIs, a donut and a bar chart. There is a loan book report with filters, sorting and paging, an EMI calculator, and loan detail pages. Charts are hand-rolled accessible SVG. | — |
| **A2** UI tests: navigation, input vs. computed value, chart visible with data | [`tests/features/loanlens-ui`](tests/features/loanlens-ui) | 56 scenarios: navigation, input vs. computed value, every chart mark's value and label, every bar of the four bar charts drawn to scale, the bar tooltip on hover and keyboard focus, keystroke-level invalid input, and reflected-XSS sinks under a Content-Security-Policy that fails any scenario it has to block. Figures are read back off the screen as a user sees them (rupees, dates, tenure) and checked against an independent oracle ([`tests/utils/emi.ts`](tests/utils/emi.ts), [`tests/utils/loan-book.ts`](tests/utils/loan-book.ts)), never against the app's own code. |
| **A3** JSONPlaceholder `POST /posts` with long, special-character and missing-field input | [`tests/features/jsonplaceholder`](tests/features/jsonplaceholder) | 36 scenarios: one per distinct crash risk and one per invalid-input partition, plus 4 controls. Findings are in [`docs/jsonplaceholder-findings.md`](docs/jsonplaceholder-findings.md). |
| **B1** Own API with mock JSON, query params and error codes | [`app/server`](app/server): Express 5 over 120 seeded loans. Endpoints: `/api/loans` (10 filters, sort, paging), `/api/loans/:id`, `/api/loans/summary`, `/api/emi`, `/api/meta` and `/api/health`. Errors are 400/404/405 with a structured `details[]`. | — |
| **B2** API tests: happy paths, invalid params, status and shape | [`tests/features/loanlens-api`](tests/features/loanlens-api) | 106 scenarios, with JSON Schema checks (ajv) and expectations computed from the request, never from the response: the value on and just past each limit (the amount, rate and date filter edges sit exactly on a seeded loan), hostile numbers (`+100000`, `1e5`, `8,5`, fractions of a paisa), parameter pollution, `__proto__`, a query-parameter cap, the filter vocabulary, security headers, CORS, write methods and malformed URLs, plus 200 random loans checked against my own amortisation (seed pinned; `PBT_SEED=random` varies it). |
| **B3** emicalculator.net TC1 (pie, scenarios A and B) and TC2 (sliders, calendar, bar count, tooltips) | [`tests/features/emicalculator`](tests/features/emicalculator), [`tests/pages/emicalculator`](tests/pages/emicalculator) | The 3 brief scenarios, plus 35 on valid formats and boundaries, one row per invalid partition that fails, the EMI-scheme rules and Yr/Mo switching. Results are compared within ₹1 of my own EMI and amortisation. The site's input defects are in [`docs/emicalculator-findings.md`](docs/emicalculator-findings.md). |
| **A4 / B4** SQL: round-trip transfers, IPL 30+ streaks, schema, output screenshots | [`sql/`](sql) (see [`sql/README.md`](sql/README.md)) | 6 scenarios on PostgreSQL 18 (in-process PGlite): per query, the exact result against a hand-worked table and an independent oracle (with near misses that must exist in the seed and stay out), a deliberately wrong query that must be rejected, and the output screenshot. Screenshots are in [`sql/results`](sql/results). |
| Self-healing: 3–5 broken locators plus an explanation | [`tests/pages/self-healing/LegacyLocators.ts`](tests/pages/self-healing/LegacyLocators.ts), [`self-healing/`](self-healing), [`docs/SELF_HEALING.md`](docs/SELF_HEALING.md) | 5 broken locators, a working POC (Claude via `claude -p`, the Messages API, or an offline heuristic), validation gates, and reviewable patches. |

## Setup

Requirements: Node 22.12+, 24 or 26+ (the lines Cucumber 13 and Vite support; CI uses 22, developed on 26.7) and npm.

```bash
npm ci
npx playwright install chromium     # the browser Playwright drives
npm run build                       # builds the LoanLens web UI into app/web/dist
```

Nothing else is needed. The LoanLens server starts automatically for the suites that use it. The SQL runs on an embedded PostgreSQL (PGlite), so no database install is needed. The external suites need internet access.

## How to run

| Command | What it runs |
|---|---|
| `npm run test:all` | Builds, runs every suite, and writes `reports/SUMMARY.md`. Exits 1 only on *unexpected* failures. |
| `npm test` | Build, then LoanLens UI, LoanLens API and SQL (the self-contained suites). |
| `npm run test:loanlens-ui` / `test:loanlens-api` | A2 / B2 against the local app. |
| `npm run test:jsonplaceholder` | A3 against the public API. Exits 1 by design: 16 pass, 20 fail as `@known-defect` (see [Findings](#findings)). Add `-- --tags 'not @known-defect'` for the green subset. |
| `npm run test:emicalculator` | B3 against the live site. |
| `npm run test:sql` | A4/B4. `npm run sql:render` regenerates the result screenshots. |
| `npm run test:self-healing` | The 5 broken locators with healing off. They fail, by design. |
| `npm run heal [-- --provider heuristic\|claude-cli\|anthropic]` | The same scenarios with healing on, writing validated patches. |
| `npm run heal:eval [-- --providers heuristic,claude-cli --trials 3]` | Scores the healer against ground truth from the healthy page objects, with and without the fingerprint. Writes `reports/self-healing-eval/EVAL.md`. |
| `npm run dev` | The app for manual use: API on :5055, Vite dev server on :5174. `npm start` serves the built UI and the API together on :5055. |
| `npm run test:mutation [-- E09 U05 …]` | Plants 61 hand-written bugs in a temporary copy of LoanLens, one at a time, and checks the owning suite catches each. Writes `reports/mutation/SUMMARY.md`; exits 1 if any survives or fails to run cleanly. About 9 minutes; pass mutant IDs to run a subset. |
| `npm run typecheck` | `tsc --noEmit` over the app, tests, SQL and healer. |

Extra Cucumber arguments pass through, for example `node scripts/run-suite.mjs loanlens-ui --name "Sorting"` or `node scripts/run-suite.mjs jsonplaceholder --tags @control`.

## Configuration

Nothing is hardcoded. URLs, browser, timeouts and artifacts come from `config/env/.env.<TEST_ENV>`; local is the default and CI uses `TEST_ENV=ci`. A git-ignored `.env.<TEST_ENV>.local` file overrides it, and real environment variables override both.

| Key | Purpose |
|---|---|
| `APP_PORT`, `APP_BASE_URL`, `APP_API_URL`, `APP_AUTOSTART` | Where LoanLens runs, and whether the runner starts it. |
| `JSONPLACEHOLDER_URL`, `EMI_CALCULATOR_URL` | The external systems under test. |
| `BROWSER` (chromium/firefox/webkit), `BROWSER_CHANNEL`, `HEADLESS`, `SLOW_MO`, `VIEWPORT_*` | Browser. |
| `DEFAULT_TIMEOUT_MS`, `STEP_TIMEOUT_MS` | Timeouts. |
| `TRACE` (`retain-on-failure`), `SCREENSHOTS` (`on-failure`) | Artifacts. A failure leaves a screenshot in the report and a Playwright trace in `reports/<suite>/traces/`. |
| `SELF_HEAL` (off/suggest/heal), `HEAL_PROVIDER`, `HEAL_MODEL` | Self-healing. |

## Architecture

```
app/
  server/            Express 5 API: routes/, lib/query.ts (declarative query-param validation), lib/errors.ts, data/loans.json
  web/               React + Vite UI: pages/, components/ (accessible SVG charts), lib/
tests/
  features/<suite>/  Gherkin: what is tested, in business language
  steps/             step definitions: thin, delegate to pages/api clients
  pages/             Page Objects: loanlens/, emicalculator/ (component objects: Slider, PieChart, ColumnChart, MonthPicker), self-healing/
  api/               API clients (BaseApiClient captures every exchange), JSON Schemas, JSONPlaceholder payload catalogue
  utils/             independent oracles: emi.ts, loan-book.ts (they never import app code)
  support/           World (per-scenario state, evidence capture), hooks (browser, tracing, app server)
  config/env.ts      the only place configuration is read
self-healing/        healer runtime, providers (claude-cli, anthropic, heuristic), validation, patch writer
sql/                 schema, seed, queries, deliberately wrong queries, TypeScript oracle, result renderer
scripts/             run-suite.mjs (one suite, report dir, tee'd log, app lifecycle), run-all.mjs (everything + SUMMARY.md), mutation-check.mjs
reports/             committed results of the last full run
```

Design decisions that shape the tests:

- **Independent oracles.** A test that compares the app with the app's own formula proves nothing.
  - `tests/utils/emi.ts` and `tests/utils/loan-book.ts` re-implement the EMI, the amortisation, filtering, sorting and the summaries. They never import from `app/`.
  - The same oracle checks LoanLens, the LoanLens API *and* emicalculator.net.
- **Locators.** Role + accessible name first, then label, with test ids only for values that have no accessible name. Outside the deliberately broken legacy page object there is no XPath, no `waitForTimeout` and no `force: true`, and `nth()` is used only to walk every point of a chart.
  - The LoanLens UI was built to be testable: real `<table>`s named by their section headings (`aria-labelledby`), named `group` and `figure` elements, and charts whose marks carry accessible names.
  - emicalculator.net has no ARIA on its sliders or charts. There the component objects anchor on the widget's stable id and on Highcharts' documented class names, and read only what a user sees.
- **The sliders are dragged, not set.** TC2 asks for the sliders, so `Slider.setTo` drags the handle to the value's position on the track and then nudges it with the arrow keys until the bound box shows the exact target. The report records each slider's start value, so a slider that was already at the target cannot pass unexercised.
- **Evidence.** Every scenario that checks a number attaches the measured and the expected values, plus screenshots. A green run therefore shows *what* was compared, not just that something passed.
- **One app server per run.** `run-suite.mjs` starts LoanLens once, before the parallel Cucumber workers spawn. If each worker started one, they would race for the port (see the reflection below).
- **Each rule is tested once, where it lives.** Validation rules belong to the API, so the API suite owns the partitions and boundaries, and the UI has one row per field to prove the refusal lands in the right place. A row that fails only when another row fails too was cut ([what was cut and why](docs/TEST_DESIGN.md#what-was-cut-and-why)).
- **The tests are proven able to fail.** `npm run test:mutation` plants 61 realistic bugs, one at a time: an off-by-one limit, `Math.abs` on input, first-value-wins parameters, years read as months, a missing header, `'unsafe-inline'` in the CSP, HTML rendering of a URL value, rupees truncated, dates in the wrong time zone, chart bars drawn at the wrong height. All 61 are caught ([`reports/mutation/SUMMARY.md`](reports/mutation/SUMMARY.md)). One needed a stubbed API answer to reach: no seeded loan has a part-year tenure, so only a stub can show "7 yr 6 mo".
- **Expected failures are tagged, not hidden.**
  - Defects of the public API are `@known-defect`; the broken locators are `@broken-locator`.
  - `run-all` exits 1 only on untagged failures, so CI stays meaningful without weakening a single assertion.

## Findings

### JSONPlaceholder (A3)

Full write-up, with `curl` reproductions: [`docs/jsonplaceholder-findings.md`](docs/jsonplaceholder-findings.md).

- **JP-01 (High).** A body over 10 MiB returns **500** with a `PayloadTooLargeError` stack trace. Expected: 413.
- **JP-02 (High).** Malformed JSON returns **500** with a `SyntaxError` stack trace. Expected: 400. Both leak `node_modules` paths.
- **JP-03 to JP-06 (Medium).** No validation at all. Every other invalid input returns **201**:
  - too-long strings;
  - NUL and control characters, and lone surrogates;
  - missing `userId`/`title`/`body`, and `{}`;
  - wrong types and non-existent users.
- **Silently changed data:** invalid UTF-8 is replaced with U+FFFD, a JSON array is stored as `{"0": …}`, a form body turns `userId` into a string, and `text/plain` JSON drops every field.

JSONPlaceholder is a documented fake ("the response is faked as if"), so the validation gaps are expected of it. Measured against the brief's expectation, they are still defects, and the suite reports them that way instead of loosening its assertions.

### emicalculator.net input handling (B3)

Full write-up, with a by-hand reproduction and the cause in the site's script: [`docs/emicalculator-findings.md`](docs/emicalculator-findings.md).

The site never refuses an entry. It rewrites any invalid entry into some number and shows a plan for that number:
- **EC-01 (High).** Type `-2383434` and press Enter. The box keeps the minus sign, but the EMI shown (₹1,08,341) is for **+**₹23,83,434.
- **EC-03 (High).** `12abc34` is calculated as ₹1,234, and `1e6` as ₹16.
- **EC-07 (High).** A rate of `8,5` becomes **85%**, so the EMI on ₹50 lakh jumps from ₹43,391 to ₹3,54,167.
- **EC-06 (Medium).** A 0% rate (no-cost EMI) is replaced with 9%.
- **EC-02, EC-05, EC-09 (Medium).** Zero, empty, letters and negative values become ₹0, positive values, or 1 year.
- **EC-04 and EC-08 (Low).** `NaN` is shown in the box, and 26-digit amounts lose precision.

15 `@known-defect` scenarios cover these: one per invalid partition that fails, plus Tab and Enter for the negative amount, where the site behaves differently. The 23 others pass, including the valid formats it does handle (`15,00,000`, `₹15,00,000`, `8.5%`) and its EMI-in-advance maths.

### LoanLens defects found by the same techniques, and fixed

| Where | Found | Now |
|---|---|---|
| Reports | `?page=9999` showed "Showing 99981–120 of 120 loans" | "There is no page 9,999. This report has 12 pages." with a button to the last page |
| Reports | `?page=abc`, `0`, `-3` were silently ignored | Page 1, with a note naming the bad value |
| Calculator | A tenure of `-2` years said "must be between 1 and 480", with no unit | "…a whole number of months between 1 and 480 (got -24 months)" |
| Calculator | `1e6` said "must be a number"; `--5` said "Enter a loan amount" | "must be written in plain digits", and "must be a number" |
| API + calculator | `100000.555` (fractions of a paisa) was accepted | "must have at most 2 decimal places" |
| API | `/api/loans/%E0%A4%A` (broken percent-encoding) returned **500** | 400 `MALFORMED_URL` |
| API | `?__proto__=x` returned 200, where any other unknown parameter is a 400: the check used `key in schema`, which is true for inherited names | 400 `unknown_parameter` |
| Pages + API | No Content-Security-Policy, `nosniff` or `Referrer-Policy`, so the pages could be framed (clickjacking) | `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `nosniff`, `no-referrer`. Every UI scenario that renders a page fails if the policy has to block anything |
| API | My own first fix of the tenure message printed `got 1.2000000000000002 months` for 0.1 years | `got 1.2 months` |
| Loan detail | `/loans/%E0%A4%A` threw `URIError` while building the page title | "Loan not found", naming the value as not a valid loan ID |
| Pages | `POST /` answered 404 with Express's default HTML error page ("Cannot POST /") | 405 with `Allow: GET, HEAD`, as the API does |
| API | Responses were cacheable, and any number of query parameters was parsed (Express's default limit is 1,000) | `Cache-Control: no-store`; more than 50 parameters is a 400 `TOO_MANY_PARAMETERS` |

Each fix was reverted on purpose to confirm that its new scenarios fail without it. For the API and header fixes, `--5`, `1e6` and the decimal page number, `npm run test:mutation` now repeats that revert automatically.

### LoanLens precision (B1/B2)

- **What:** at the extreme corner (₹10 crore, 50% p.a., 480 months) the API's yearly schedule drifts from the exact result.
- **Measured:** against a 60-digit `Decimal` amortisation, the 2061 closing balance is off by **+₹1.04** and, with a January 2026 start, the 2064 balance by **+₹7.07**.
- **Cause:** float64 error compounding through `(1+r)^n`.
- **Tests:** EMI and totals are compared to the paisa. Schedule rows, where the error compounds, are compared within max(₹1, 2e-7 × principal).
- **Recommendation:** production lending code should use decimal or integer-paise arithmetic.

### emicalculator.net (B3)

Every figure matched my own calculation within the site's rupee rounding.
- **TC1:** EMIs ₹33,038 and ₹46,351; pie split 63.1/36.9% and 59.9/40.1%.
- **TC2:** all 6 calendar-year bars and both tooltip parts of each bar, for a schedule starting in Mar 2027.

Two behaviours of the site shaped the page objects:
- **Selected pie slice.** The interest slice is drawn *selected*, which suppresses Highcharts' hover class, so the pie waits for its tooltip text to change instead.
- **Covered columns.** The Balance spline's markers cover parts of the columns, so a forced hover at a column's centre can land on a marker and read the previous tooltip. The chart object hovers only at a point where the column is the topmost element.

## Self-healing locators

[`docs/SELF_HEALING.md`](docs/SELF_HEALING.md) has the full design and the measured results. In short:

- **The broken locators.** There are five, each a different kind of rot: a renamed test id, changed button copy, a label that became ambiguous, a positional locator that silently finds the *wrong* table, and a removed feature. With healing off they fail with a precise diagnosis.
- **What the healer gets.** It sees the declared intent and fingerprint, the failure class, the ARIA snapshot and an element inventory. It answers in a restricted locator vocabulary: never CSS or XPath, and never code.
- **Validation.** Every answer must pass the same gates: unique, visible, matching the fingerprint (role, name, container), and replayed against the oracle-backed assertions. The result is a patch for a person to review; each of the 4 in the committed report passes `git apply --check`. The tool never edits source.
- **Evaluated, not just demoed.** `npm run heal:eval` scores each accepted locator against the element the healthy page objects find, 3 trials per case, with the fingerprint shown to the healer (*open*) and withheld (*blind*). Besides the five exercise locators it has two decoy cases, built to offer a plausible wrong answer: a "Principal" figure with eight chart bars and a legend item of the same name, and "Clear all filters" renamed "Reset" next to an "Apply filters" button. Over 84 trials there were **0 false heals**, and every removed-feature trial was refused.
  - Claude Sonnet (`claude -p`): 18/18 correct in both conditions, decoys included; about 4.4 s and $0.007 per call.
  - Offline heuristic: 18/18 open, 6/18 blind. Blind, it offered exactly the decoys ("Apply filters" for Reset), and the validator rejected every wrong candidate it offered (42 of 42 in each condition) and no right one.
  - Claude never offered a wrong candidate, so the validator is still untested on its answers. Seven cases written by the person who wrote the healer make this a regression check, not a benchmark; section 5 of `SELF_HEALING.md` has the limits.

## Claude Code reflection

I used Claude Code as a pair programmer. It scaffolded the layers I specified, ran two sub-agents in parallel (the LoanLens UI with its suite, and the SQL), probed emicalculator.net's DOM and JSONPlaceholder's real responses before any test asserted on them, and is the LLM behind the self-healing POC.

**What worked:** speed on structure (page objects, step wiring, schemas, report plumbing), fast exploration of an unfamiliar DOM, and turning a failing run into a precise hypothesis.

**What did not.** Every case, with how it was caught, is in [`docs/ai-pairing-log.md`](docs/ai-pairing-log.md). The three that matter most:
- **It wrote a wrong oracle.** `URLSearchParams.get` keeps only the first `type`, so a test expected 39 loans where the API correctly returned 66. A disagreement between test and app is investigated, not settled in the test's favour.
- **Its first move on a numeric mismatch was to widen the tolerance.** An exact `Decimal` computation showed both sides drifted, the app further. That became a finding, and the one tolerance that stayed wide (schedule rows) is sized from the measured drift. EMI and totals are checked to the paisa, so a planted whole-rupee rounding bug (mutant E08), which the old ₹1 tolerance let through, now fails 10 scenarios.
- **Its "malformed JSON" test sent valid JSON**, because Playwright re-encodes a string body. The server's error message gave it away.

**What I'd keep doing:** make the AI prove every claim against the real system, and keep oracles independent of the code under test.

## Notes

- Built and run on macOS (Node 26.7, Chromium via Playwright 1.63).
- The CI workflow ([`.github/workflows/tests.yml`](.github/workflows/tests.yml)) runs on Ubuntu with the offline heuristic healer, in three jobs:
  - a gate (typecheck, then LoanLens UI and API, SQL and both self-healing suites);
  - the mutation check, after the gate passes;
  - the two public sites, weekly as well, allowed to fail without blocking the gate because this repo does not control them.

  GitHub Actions has not run it yet. Its steps were run earlier in a `node:22` Linux container (Docker, arm64): `npm ci`, the Playwright install, typecheck and `npm test` all passed (46 UI / 112 API / 40 SQL scenarios, before the later additions and cuts). The external-site suites, the mutation check and the healer evaluation were not run from Linux.
- All loan data is synthetic, generated from a fixed seed by `npm run data:generate`.
