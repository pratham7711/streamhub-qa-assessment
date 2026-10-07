# Streamhub QA automation assessment

The brief asks for Section A *or* Section B. Both are done, and each is a project of its own, in its own folder. Each has its own `package.json` and lockfile, test framework, SQL, self-healing engine, reports and README, and neither reads or imports anything from the other. Either can be installed, run and graded alone.

| | [Section A](sectionA/README.md) | [Section B](sectionB/README.md) |
|---|---|---|
| Brief | Web application + UI automation (A1–A4) | API development + API automation (B1–B4) |
| Start here | [`sectionA/README.md`](sectionA/README.md) | [`sectionB/README.md`](sectionB/README.md) |
| Run | `cd sectionA && npm ci && npx playwright install chromium && npm test` | `cd sectionB && npm ci && npx playwright install chromium && npm test` |
| Results | [`sectionA/reports/SUMMARY.md`](sectionA/reports/SUMMARY.md) | [`sectionB/reports/SUMMARY.md`](sectionB/reports/SUMMARY.md) |
| Last run | **0 unexpected failures**: 57 UI, 36 JSONPlaceholder, 6 SQL and 10 self-healing scenarios. The 26 red ones are expected. | **0 unexpected failures**: 106 API, 38 emicalculator.net, 6 SQL and 10 self-healing scenarios. The 21 red ones are expected. |
| Mutation check | 18 of 18 planted bugs caught ([summary](sectionA/reports/mutation/SUMMARY.md)) | 49 of 49 planted bugs caught ([summary](sectionB/reports/mutation/SUMMARY.md)) |

Each section has its own app, and the two are not connected:
- **Section A's web app** ([`sectionA/app`](sectionA/app)) is a React UI that reads its mock data in the browser, from a JSON file shipped with it. It makes no API calls.
- **Section B's API** ([`sectionB/api`](sectionB/api)) is an Express server over its own mock data file. It serves no pages.

Both are called LoanLens because they model the same loan book: 120 synthetic loans from the same deterministic generator and seed. Each section carries its own copy of the generator, and the two data files are identical.

Requirements: Node 22.12+, 24 or 26+ and npm. The suites start their own app, the SQL runs on an embedded PostgreSQL (PGlite), and the suites against public sites need internet access. Nothing else needs installing.

## Claude Code reflection

I used Claude Code as a pair programmer. It scaffolded the layers I specified, ran two sub-agents in parallel (the LoanLens UI with its suite, and the SQL), probed emicalculator.net's DOM and JSONPlaceholder's real responses before any test asserted on them, and is the LLM behind the self-healing POC.

**What worked:** speed on structure (page objects, step wiring, schemas, report plumbing), fast exploration of an unfamiliar DOM, and turning a failing run into a precise hypothesis.

**What did not.** Every case, with how it was caught, is in the [AI pairing log](#ai-pairing-log) below. The three that matter most:
- **It wrote a wrong oracle.** `URLSearchParams.get` keeps only the first `type`, so a test expected 39 loans where the API correctly returned 66. A disagreement between test and app is investigated, not settled in the test's favour.
- **Its first move on a numeric mismatch was to widen the tolerance.** An exact `Decimal` computation showed both sides drifted, the app further. That became a finding, and the one tolerance that stayed wide (schedule rows) is sized from the measured drift. EMI and totals are checked to the paisa, so a planted whole-rupee rounding bug (mutant E08), which the old ₹1 tolerance let through, now fails 10 scenarios.
- **Its "malformed JSON" test sent valid JSON**, because Playwright re-encodes a string body. The server's error message gave it away.

**What I'd keep doing:** make the AI prove every claim against the real system, and keep oracles independent of the code under test.

## AI pairing log

What Claude Code got wrong, and how it was caught. These are real incidents from building this repository, written down when they happened, and they are the raw material for the reflection above. They were recorded before the repository was split into two folders, so they name LoanLens as one app.

| # | What the AI produced | How it was caught | Fix |
|---|---|---|---|
| 1 | Two step definitions, `I send a GET request to {string}` and `I send a {word} request to {string}`. Cucumber Expressions match both against the same text. | First suite run: "Multiple matching step definitions found". | One step that switches on the HTTP method. |
| 2 | A `Before` hook that started the app server once per Cucumber worker. With `parallel: 4`, four servers raced for port 5055. Express 5 hands the bind error to the `listen` callback, so the losers printed "listening" and exited with code 0. | 5 of 6 scenarios failed with "LoanLens exited early (code 0)". The misleading log line took a second look. | The suite runner starts the app once, before the workers spawn. The server now handles `error` and exits non-zero. |
| 3 | The test oracle read `?type=home&type=car` with `URLSearchParams.get`, which returns only the first value. The API merged both, as documented. | The oracle expected 39 loans and the API returned 66. The bug was in the test, not the app. | `getAll` + merge. |
| 4 | EMI schedule assertions with `toBeCloseTo(x, 0)`, i.e. ±₹0.50. | ₹10 crore at 50% for 480 months: the app and the oracle use algebraically identical EMI formulas, but floating-point error grows with `(1+r)^n` and they drifted by ₹0.58. | Money is compared to ±₹1, with the reason recorded in the helper. |
| 5 | Widening the tolerance until the test passed would have been the easy move. | Before changing the number, an exact `Decimal` (60-digit) amortisation decided which side was wrong. The true 2061 closing balance is ₹9,10,04,967.52; the app returned …968.56 (+₹1.04) and the oracle …967.04 (−₹0.48). Both are float64 drift of about 1e-8 relative. | Tolerance = max(₹1, 1e-7 × loan principal), because the error scales with the loan, not with each row, documented next to the assertion. Later raised to 2e-7, after the same Decimal check: at the ₹10 crore / 50% / 480-month corner the 2064 balances differ by ₹10.38 (app +₹7.07, oracle −₹3.31). EMI and totals, which do not compound, are now checked to the paisa. Recorded as a finding: production lending code should use decimal or integer-paise arithmetic. |
| 6 | The first "Boundaries" example pushed every input to its maximum in one row (₹10 crore, 50%, 480 months). | The schedule drift kept growing toward maturity (₹10.8 by 2065). Each widened tolerance failed further down the schedule, which showed the tolerance was not the real problem. | Boundaries now vary one parameter at a time, which is standard boundary-value analysis. The combined corner is reported as a precision finding in the README instead of being hidden behind a looser tolerance. |
| 7 | The "malformed JSON" payload was passed to `request.post` as a string. | The 500's stack trace named `createStrictSyntaxError` and quoted `"#"`. A truncated object would fail with "Unterminated string", so the server had received something else: given a string that does not parse, with a JSON content type, Playwright JSON-encodes it into a valid string literal. The test was not sending what its name claimed. | Raw payloads are always sent as a `Buffer`. Now the server reports "Unterminated string in JSON at position 23", the same as `curl`. |
| 8 | The first draft of the findings doc quoted JSONPlaceholder's guide from memory: "the resource will not be really updated…". | Checked against the live page before publishing. The real sentence for POST is "The resource is not really created on the server, but the response is faked as if." | Quote replaced with the verbatim text. |
| 9 | In the mutation check, mutant E07 (the last instalment not adjusted to clear the balance) was marked "equivalent", reasoning that a level EMI already clears the loan. | Measured instead of argued: without the adjustment the ₹10 crore / 50% / 480-month loan ends ₹11.55 short, and 1.2% of 200,000 random loans end at least half a paisa short. The final balance had been compared within the drift tolerance (about ₹20 at that size), which hid it. | The final balance is asserted to be exactly ₹0.00, and the combined corner from #6 is back as a boundary row, so E07 is caught on every run instead of only when a random draw hits it. |
| 10 | The first oracle for the summary's monthly EMI inflow added up the exact EMIs; the API adds up the EMIs as quoted, in paise. | Tightening the comparison from ₹1 to the paisa (to kill a mutant that rounded the inflow to whole rupees) showed a 1-paisa gap: 38,72,687.93 vs …92. | The oracle sums the quoted EMIs, because that is what borrowers pay. The ₹1 tolerance had been hiding an oracle that modelled the wrong quantity. |

## Notes

- Built and run on macOS (Node 26.7, Chromium via Playwright 1.63).
- The CI workflow ([`.github/workflows/tests.yml`](.github/workflows/tests.yml)) runs each section in its own folder on Ubuntu, with the offline heuristic healer:
  - Section A: typecheck, then the web app's UI suite, SQL and both self-healing suites. Section B: typecheck, then the API suite and SQL.
  - Each section's mutation check, after those pass.
  - Each section's public site, weekly as well: JSONPlaceholder for A; for B, emicalculator.net and Section B's self-healing exercise, which runs on it. These jobs may fail without blocking the rest, because this repo does not control those sites.

  Before the split into sections, the suites passed on GitHub Actions in [run 37576175866](https://github.com/pratham7711/streamhub-qa-assessment/actions/runs/37576175866) (2026-10-07), including the mutation check.
- All loan data is synthetic, generated from a fixed seed by `npm run data:generate` in each section.
