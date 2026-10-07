# Streamhub QA automation assessment

The brief asks for Section A *or* Section B. Both are done, and each stands on its own: its own folder, its own command, its own reports and its own README. Either can be run and graded without reading the other.

| | Section A | Section B |
|---|---|---|
| Brief | Web application + UI automation (A1–A4) | API development + API automation (B1–B4) |
| Start here | [`section-a/README.md`](section-a/README.md) | [`section-b/README.md`](section-b/README.md) |
| Run | `npm run test:section-a` | `npm run test:section-b` |
| Results | [`section-a/reports/SUMMARY.md`](section-a/reports/SUMMARY.md) | [`section-b/reports/SUMMARY.md`](section-b/reports/SUMMARY.md) |
| Last run | **0 unexpected failures**: 56 UI, 36 JSONPlaceholder, 6 SQL and 10 self-healing scenarios; the 25 red ones are expected | **0 unexpected failures**: 106 API, 38 emicalculator.net, 6 SQL and 10 self-healing scenarios; the 20 red ones are expected |
| Mutation check | 12 of 12 planted bugs caught ([summary](section-a/reports/mutation/SUMMARY.md)) | 49 of 49 planted bugs caught ([summary](section-b/reports/mutation/SUMMARY.md)) |

Both sections use the same few shared parts, kept outside the section folders:
- **LoanLens** ([`app/`](app)): a lending app I built. `app/web` is Section A's web app; `app/server` is its backend and Section B's API.
- **The framework** ([`framework/`](framework)): World, hooks, configuration, the base API client and the independent oracles. Each suite loads the framework plus its own steps only, so neither section's suites can depend on the other's code.
- **SQL** ([`sql/`](sql)): A4 and B4 are the same two queries.
- **Self-healing** ([`self-healing/`](self-healing), [`docs/SELF_HEALING.md`](docs/SELF_HEALING.md)): the AI exercise, with a working proof of concept and an evaluation.
- **How the test cases were chosen** ([`docs/TEST_DESIGN.md`](docs/TEST_DESIGN.md)): which layer owns which risk, the techniques (partitions, boundaries, error guessing, decision tables, state transitions), security tests mapped to OWASP IDs, a property-based check, and a mutation check.
- **The [Claude Code reflection](#claude-code-reflection)** below.

![LoanLens dashboard](docs/screenshots/dashboard.png)

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
| `npm run test:section-a` | Builds the web app, then A2 (LoanLens UI), A3 (JSONPlaceholder), A4 (SQL) and the self-healing exercise. Writes `section-a/reports/`. Exits 1 only on *unexpected* failures. |
| `npm run test:section-b` | B2 (LoanLens API), B3 (emicalculator.net), B4 (SQL) and the self-healing exercise. Writes `section-b/reports/`. Exits 1 only on *unexpected* failures. |
| `npm run test:all` (or `npm test`) | Section A, then Section B. |
| `node scripts/run-all.mjs --section a loanlens-ui sql` | Some suites of one section, still into that section's reports. |
| `npm run test:loanlens-ui`, `test:loanlens-api`, `test:jsonplaceholder`, `test:emicalculator`, `test:sql`, `test:self-healing` | One suite on its own, into the git-ignored `reports/`. Extra Cucumber arguments pass through, for example `node scripts/run-suite.mjs loanlens-ui --name "Sorting"`. |
| `npm run heal [-- --provider heuristic\|claude-cli\|anthropic]` | The 5 broken locators with healing on, writing validated patches. |
| `npm run heal:eval [-- --providers heuristic,claude-cli --trials 3]` | Scores the healer against ground truth from the healthy page objects, with and without the fingerprint. Writes `self-healing/eval-results/EVAL.md`. |
| `npm run test:mutation [-- --section a\|b] [E09 U05 …]` | Plants hand-written bugs in a temporary copy of LoanLens, one at a time, and checks the owning suite catches each: 12 for Section A, 49 for Section B. Writes `section-<a\|b>/reports/mutation/SUMMARY.md`; exits 1 if any survives or fails to run cleanly. About 9 minutes for both. |
| `npm run dev` | The app for manual use: API on :5055, Vite dev server on :5174. `npm start` serves the built UI and the API together on :5055. |
| `npm run typecheck` | `tsc --noEmit` over the app, tests, SQL and healer. |

## Configuration

Nothing is hardcoded. URLs, browser, timeouts and artifacts come from `config/env/.env.<TEST_ENV>`; local is the default and CI uses `TEST_ENV=ci`. A git-ignored `.env.<TEST_ENV>.local` file overrides it, and real environment variables override both.

| Key | Purpose |
|---|---|
| `APP_PORT`, `APP_BASE_URL`, `APP_API_URL`, `APP_AUTOSTART` | Where LoanLens runs, and whether the runner starts it. |
| `JSONPLACEHOLDER_URL`, `EMI_CALCULATOR_URL` | The external systems under test. |
| `BROWSER` (chromium/firefox/webkit), `BROWSER_CHANNEL`, `HEADLESS`, `SLOW_MO`, `VIEWPORT_*` | Browser. |
| `DEFAULT_TIMEOUT_MS`, `STEP_TIMEOUT_MS` | Timeouts. |
| `TRACE` (`retain-on-failure`), `SCREENSHOTS` (`on-failure`) | Artifacts. A failure leaves a screenshot in the report and a Playwright trace in `<section>/reports/<suite>/traces/`. |
| `SELF_HEAL` (off/suggest/heal), `HEAL_PROVIDER`, `HEAL_MODEL` | Self-healing. |

## Architecture

```
section-a/               Section A, graded on its own (README.md inside)
  loanlens-ui/           A2: features/, steps/, pages/ (Page Objects), display.ts
  jsonplaceholder/       A3: features/, steps/, api/ (client + payload catalogue), FINDINGS.md
  reports/               committed results of `npm run test:section-a` and its mutation check
section-b/               Section B, graded on its own (README.md inside)
  loanlens-api/          B2: features/, steps/, api/ (client + JSON Schemas)
  emicalculator/         B3: features/, steps/, pages/ (Page Object + component objects), FINDINGS.md
  reports/               committed results of `npm run test:section-b` and its mutation check
app/
  web/                   A1: React + Vite UI: pages/, components/ (accessible SVG charts), lib/
  server/                B1: Express 5 API: routes/, lib/query.ts (declarative query-param validation), lib/errors.ts, data/loans.json
framework/               shared by every suite
  config/env.ts          the only place configuration is read
  support/               World (per-scenario state, evidence capture), hooks (browser, tracing, app server)
  api/BaseApiClient.ts   captures every request and response as evidence
  steps/                 response assertions shared by the API suites
  oracles/               independent oracles: emi.ts, loan-book.ts (they never import app code)
sql/                     A4 = B4: schema, seed, queries, deliberately wrong queries, oracle, features/, steps/, results/
self-healing/            healer runtime, providers (claude-cli, anthropic, heuristic), validation, patch writer,
                         the broken-locator exercise (features/, steps/, pages/) and eval-results/
scripts/                 run-suite.mjs (one suite), run-all.mjs (a section + SUMMARY.md), mutation-check.mjs
docs/                    TEST_DESIGN.md, SELF_HEALING.md, ai-pairing-log.md, screenshots
```

Design decisions that shape the tests:

- **Independent oracles.** A test that compares the app with the app's own formula proves nothing.
  - `framework/oracles/emi.ts` and `framework/oracles/loan-book.ts` re-implement the EMI, the amortisation, filtering, sorting and the summaries. They never import from `app/`.
  - The same oracle checks LoanLens, the LoanLens API *and* emicalculator.net.
- **Locators.** Role + accessible name first, then label, with test ids only for values that have no accessible name. Outside the deliberately broken legacy page object there is no XPath, no `waitForTimeout` and no `force: true`, and `nth()` is used only to walk every point of a chart.
  - The LoanLens UI was built to be testable: real `<table>`s named by their section headings (`aria-labelledby`), named `group` and `figure` elements, and charts whose marks carry accessible names.
  - emicalculator.net has no ARIA on its sliders or charts. There the component objects anchor on the widget's stable id and on Highcharts' documented class names, and read only what a user sees.
- **The sliders are dragged, not set.** TC2 asks for the sliders, so `Slider.setTo` drags the handle to the value's position on the track and then nudges it with the arrow keys until the bound box shows the exact target. The report records each slider's start value, so a slider that was already at the target cannot pass unexercised.
- **Evidence.** Every scenario that checks a number attaches the measured and the expected values, plus screenshots. A green run therefore shows *what* was compared, not just that something passed.
- **One app server per run.** `run-suite.mjs` starts LoanLens once, before the parallel Cucumber workers spawn. If each worker started one, they would race for the port (see the reflection below).
- **Each rule is tested once, where it lives.** Validation rules belong to the API, so the API suite owns the partitions and boundaries, and the UI has one row per field to prove the refusal lands in the right place. A row that fails only when another row fails too was cut ([what was cut and why](docs/TEST_DESIGN.md#what-was-cut-and-why)).
- **The tests are proven able to fail.** `npm run test:mutation` plants 61 realistic bugs, one at a time: an off-by-one limit, `Math.abs` on input, first-value-wins parameters, years read as months, a missing header, `'unsafe-inline'` in the CSP, HTML rendering of a URL value, rupees truncated, dates in the wrong time zone, chart bars drawn at the wrong height. All 61 are caught: 12 of 12 in [Section A](section-a/reports/mutation/SUMMARY.md) and 49 of 49 in [Section B](section-b/reports/mutation/SUMMARY.md). One needed a stubbed API answer to reach: no seeded loan has a part-year tenure, so only a stub can show "7 yr 6 mo".
- **Expected failures are tagged, not hidden.**
  - Defects of the public API are `@known-defect`; the broken locators are `@broken-locator`.
  - `run-all` exits 1 only on untagged failures, so CI stays meaningful without weakening a single assertion.

## Findings

Each section's README has its findings: [Section A](section-a/README.md#findings) (JSONPlaceholder, and the LoanLens UI defects found and fixed) and [Section B](section-b/README.md#findings) (emicalculator.net, the LoanLens API defects found and fixed, and the API's floating-point drift at the extreme corner).

## Self-healing locators

[`docs/SELF_HEALING.md`](docs/SELF_HEALING.md) has the full design and the measured results. In short:

- **The broken locators.** There are five, each a different kind of rot: a renamed test id, changed button copy, a label that became ambiguous, a positional locator that silently finds the *wrong* table, and a removed feature. With healing off they fail with a precise diagnosis.
- **What the healer gets.** It sees the declared intent and fingerprint, the failure class, the ARIA snapshot and an element inventory. It answers in a restricted locator vocabulary: never CSS or XPath, and never code.
- **Validation.** Every answer must pass the same gates: unique, visible, matching the fingerprint (role, name, container), and replayed against the oracle-backed assertions. The result is a patch for a person to review; each section's run commits 4, and every one passes `git apply --check`. The tool never edits source.
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
- The CI workflow ([`.github/workflows/tests.yml`](.github/workflows/tests.yml)) runs on Ubuntu with the offline heuristic healer, with separate jobs per section so each can be judged alone:
  - Section A and Section B, each: typecheck, then its LoanLens suite, SQL and both self-healing suites;
  - each section's mutation check, after those pass;
  - each section's public site (JSONPlaceholder for A, emicalculator.net for B), weekly as well, allowed to fail without blocking the rest because this repo does not control them.

  Before the split into sections, the same suites passed on GitHub Actions in [run 37576175866](https://github.com/pratham7711/streamhub-qa-assessment/actions/runs/37576175866) (2026-10-07), including the mutation check.
- All loan data is synthetic, generated from a fixed seed by `npm run data:generate`.
