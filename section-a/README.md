# Section A: Web application + UI automation

This folder is Section A of the brief (A1–A4), and can be run and graded without Section B. Its web app, LoanLens, lives here in [`app/`](app) and runs on its own mock data: a JSON file shipped with the app, queried in the browser. It makes no API calls and does not use Section B's API. The shared parts it does use (the test framework, the SQL and the self-healing engine) are listed under [What else Section A uses](#what-else-section-a-uses).

![LoanLens dashboard](../docs/screenshots/dashboard.png)

## Run it

From the repository root:

```bash
npm ci
npx playwright install chromium
npm run test:section-a
```

`test:section-a` builds the web app, starts it, runs every Section A suite, and writes [`reports/SUMMARY.md`](reports/SUMMARY.md) with one row per suite. It exits 1 only on an *unexpected* failure. The red rows it expects are explained in [Findings](#findings).

| Command | What it runs |
|---|---|
| `npm run test:section-a` | A2, A3, A4 and the self-healing exercise; reports in [`section-a/reports/`](reports) |
| `node scripts/run-all.mjs --section a loanlens-ui` | One suite only (`loanlens-ui`, `jsonplaceholder`, `sql`, `self-healing`, `self-healing-healed`) |
| `npm run test:mutation -- --section a` | Plants Section A's 18 hand-written bugs in a copy of the web app, one at a time, and checks that the UI suite catches each; writes [`reports/mutation/SUMMARY.md`](reports/mutation/SUMMARY.md) |
| `npm run build && npm run start:web` | The app itself, on http://localhost:5055 (`npm run dev:web` for the Vite dev server on :5174) |

## Results

Last run: `npm run test:section-a`, 2026-10-07, macOS, Node 26.7. **0 unexpected failures.** Mutation check (`npm run test:mutation -- --section a`): **18 of 18 hand-written bugs caught.**

| Suite | Brief | Scenarios | Passed | Failed, expected | Notes |
|---|---|---|---|---|---|
| loanlens-ui | A1/A2 | 57 | 57 | 0 | 346 Gherkin steps. Every scenario that renders a page (53 of 57) also fails if the page throws or the Content-Security-Policy has to block anything |
| jsonplaceholder | A3 | 36 | 16 | 20 | `@known-defect`: 18 invalid inputs not rejected with a 4xx. 2 of them crash the server (500), so they also fail the no-server-error check |
| sql | A4 | 6 | 6 | 0 | PostgreSQL 18 via PGlite. Each query is checked against a table worked out by hand and an independent TypeScript oracle |
| self-healing (healing off) | AI exercise | 5 | 0 | 5 | `@broken-locator`, broken on purpose |
| self-healing-healed (`npm run heal`) | AI exercise | 5 | 4 | 1 | 4 healed by Claude Sonnet via `claude -p` ($0.211 for the run); the removed feature is correctly refused (`@unhealable`) |

Each suite folder under [`reports/`](reports) holds the Cucumber HTML report, JSON, JUnit XML, the console log and screenshots.

## Where each requirement lives

| Brief | Implementation | Tests |
|---|---|---|
| **A1** Web app with a dashboard, a report view and a chart | [`app/`](app): React + Vite. The dashboard has KPIs, a donut and a bar chart. There is a loan book report with filters, sorting and paging, an EMI calculator, and loan detail pages. Charts are hand-rolled accessible SVG. The data is mock data: 120 seeded loans in [`app/public/data/loans.json`](app/public/data/loans.json), which [`app/src/data/`](app/src/data) loads once and filters, sorts, pages and summarises in the browser, validating every filter and calculator value. [`app/server.ts`](app/server.ts) serves the built files with the page security headers; it has no API routes. | — |
| **A2** UI tests: navigation, input vs. computed value, chart visible with data | [`loanlens-ui/`](loanlens-ui): [`features/`](loanlens-ui/features), [`steps/`](loanlens-ui/steps), [`pages/`](loanlens-ui/pages) | 57 scenarios: navigation, input vs. computed value, every chart mark's value and label, every bar of the four bar charts drawn to scale, the bar tooltip on hover and keyboard focus, keystroke-level invalid input, and reflected-XSS sinks under a Content-Security-Policy that fails any scenario it has to block. Figures are read back off the screen as a user sees them (rupees, dates, tenure, via [`display.ts`](loanlens-ui/display.ts)) and checked against an independent oracle ([`framework/oracles/emi.ts`](../framework/oracles/emi.ts), [`framework/oracles/loan-book.ts`](../framework/oracles/loan-book.ts)), never against the app's own code. |
| **A3** JSONPlaceholder `POST /posts` with long, special-character and missing-field input | [`jsonplaceholder/`](jsonplaceholder): [`features/`](jsonplaceholder/features), [`steps/`](jsonplaceholder/steps), [`api/`](jsonplaceholder/api) (client and payload catalogue) | 36 scenarios: one per distinct crash risk and one per invalid-input partition, plus 4 controls. Findings, with `curl` reproductions: [`jsonplaceholder/FINDINGS.md`](jsonplaceholder/FINDINGS.md). |
| **A4** SQL: round-trip transfers, IPL 30+ streaks, schema, output screenshots | [`sql/`](../sql) (see [`sql/README.md`](../sql/README.md)); the same SQL answers B4 | 6 scenarios on PostgreSQL 18 (in-process PGlite): per query, the exact result against a hand-worked table and an independent oracle (with near misses that must exist in the seed and stay out), a deliberately wrong query that must be rejected, and the output screenshot. Screenshots: [`sql/results`](../sql/results). |
| Framework: feature, step and page files, environment config, resilient locators | [`framework/`](../framework) plus the per-suite folders above | URLs and timeouts come from `config/env/.env.<TEST_ENV>`; see [Configuration](../README.md#configuration). |
| Self-healing: 3–5 broken locators plus an explanation | [`self-healing/pages/LegacyLocators.ts`](self-healing/pages/LegacyLocators.ts), [`self-healing/features`](self-healing/features), the healer in [`../self-healing/`](../self-healing), [`docs/SELF_HEALING.md`](../docs/SELF_HEALING.md) | 5 locators broken on purpose in a page object for the LoanLens web app, a working POC (Claude via `claude -p`, the Messages API, or an offline heuristic), validation gates and reviewable patches. |
| Claude Code reflection | [Root README](../README.md#claude-code-reflection) | — |

## What else Section A uses

- **The framework** ([`framework/`](../framework)): World, hooks (browser, tracing, starting the web app), configuration and the independent oracles. Each Section A suite loads the framework and its own steps only ([`cucumber.js`](../cucumber.js)), so nothing here depends on Section B code. The loan-book oracle reads this app's own copy of the mock data.
- **SQL** ([`sql/`](../sql)) is shared with Section B (A4 and B4 are the same two queries). It runs under `npm run test:section-a`, and its results land in this folder's `reports/`.
- **The self-healing engine** ([`self-healing/`](../self-healing)): the healer, its providers, validation and patch writer. Section A's exercise (the broken locators, feature and steps) is in [`self-healing/`](self-healing) here; Section B has its own on emicalculator.net.
- **The mock data generator** ([`scripts/generate-loans.ts`](../scripts/generate-loans.ts)) writes this app's [`loans.json`](app/public/data/loans.json) and Section B's copy from the same seed. Nothing here reads Section B's copy.

## Findings

### JSONPlaceholder (A3)

Full write-up, with `curl` reproductions: [`jsonplaceholder/FINDINGS.md`](jsonplaceholder/FINDINGS.md).

- **JP-01 (High).** A body over 10 MiB returns **500** with a `PayloadTooLargeError` stack trace. Expected: 413.
- **JP-02 (High).** Malformed JSON returns **500** with a `SyntaxError` stack trace. Expected: 400. Both leak `node_modules` paths.
- **JP-03 to JP-06 (Medium).** No validation at all. Every other invalid input returns **201**:
  - too-long strings;
  - NUL and control characters, and lone surrogates;
  - missing `userId`/`title`/`body`, and `{}`;
  - wrong types and non-existent users.
- **Silently changed data:** invalid UTF-8 is replaced with U+FFFD, a JSON array is stored as `{"0": …}`, a form body turns `userId` into a string, and `text/plain` JSON drops every field.

JSONPlaceholder is a documented fake ("the response is faked as if"), so the validation gaps are expected of it. Measured against the brief's expectation, they are still defects, and the suite reports them that way instead of loosening its assertions. The 20 red rows are 18 invalid inputs that were not rejected with a 4xx; 2 of those also crash the server, so they fail the no-server-error check too.

### LoanLens UI defects found by the same techniques, and fixed

| Where | Found | Now |
|---|---|---|
| Reports | `?page=9999` showed "Showing 99981–120 of 120 loans" | "There is no page 9,999. This report has 12 pages." with a button to the last page |
| Reports | `?page=abc`, `0`, `-3` were silently ignored | Page 1, with a note naming the bad value |
| Calculator | A tenure of `-2` years said "must be between 1 and 480", with no unit | "…a whole number of months between 1 and 480 (got -24 months)" |
| Calculator | `1e6` said "must be a number"; `--5` said "Enter a loan amount" | "must be written in plain digits", and "must be a number" |
| Calculator | `100000.555` (fractions of a paisa) was accepted | "must have at most 2 decimal places" |
| Pages | No Content-Security-Policy, so the pages could be framed (clickjacking) | `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`. Every UI scenario that renders a page (53 of 57) fails if the policy has to block anything |
| Loan detail | `/loans/%E0%A4%A` threw `URIError` while building the page title | "Loan not found", naming the value as not a valid loan ID |
| Pages | `POST /` answered 404 with Express's default HTML error page ("Cannot POST /") | 405 with `Allow: GET, HEAD` |

Each fix was reverted on purpose to confirm that its new scenarios fail without it, and `npm run test:mutation -- --section a` repeats that revert automatically for the CSP, the framing header, the page-level 405, `--5`, `1e6`, the decimal page number, the URL escape and the decimal-places rule. It also plants bugs in the in-browser data layer (EMI maths, the inflow figure, search, the city filter, sort direction), which the UI suite has to catch from the screen alone.

## Folder map

```
section-a/
  app/                  A1: the web app. src/pages, src/components, src/data (queries over the mock data),
                        public/data/loans.json (the mock data), server.ts (serves the build)
  loanlens-ui/          A2: features/, steps/, pages/ (Page Objects), display.ts (reads figures back as a user sees them)
  jsonplaceholder/      A3: features/, steps/, api/ (client + payload catalogue), FINDINGS.md
  self-healing/         the AI exercise: features/, steps/, pages/LegacyLocators.ts (5 broken locators)
  reports/              results of the last `npm run test:section-a` and of the Section A mutation check
sql/                    A4 (= B4)              (shared repo root)
self-healing/           the healer engine      (shared)
framework/              World, hooks, config, oracles (shared)
```
