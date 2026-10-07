# AI self-healing locators

The brief asks for 3–5 incorrect or brittle locators, left broken, and an explanation of how an AI could detect, fix and validate them. The locators are broken. There is also a working proof of concept: it detects each failure, asks Claude (or an offline heuristic) for a fix, validates the answer, and writes a patch for a person to review. It never edits the source.

The healer engine is in [`self-healing/`](../self-healing). This section's exercise is five broken locators on emicalculator.net, the B3 target. (Section A carries its own copy of the engine, with an exercise on its LoanLens web app.)

```bash
npm run test:self-healing                 # healing off: the 5 scenarios fail with a diagnosis (expected)
npm run heal                              # healing on, provider "auto": validated fixes used for this run only
npm run heal -- --provider heuristic      # offline, no model
npm run heal -- --mode suggest            # propose and validate, but keep the tests red
```

## The broken locators

The exercise is a "legacy" page object, [`self-healing/pages/LegacyEmiLocators.ts`](../self-healing/pages/LegacyEmiLocators.ts), used only by [`self-healing/features/broken-locators.feature`](../self-healing/features/broken-locators.feature) (`@broken-locator`, excluded from the regular suites). Each locator reproduces a different way locators rot. A third-party page cannot be changed to break a locator, so these are written wrong against the live page instead.

| # | Locator | What is on the page | Failure class |
|---|---|---|---|
| 1 | `locator('#loan-term')` | The tenure box's id is `#loanterm` | no match |
| 2 | `getByRole('link', { name: 'Personal Loans', exact: true })` | The tab reads "Personal Loan" | no match |
| 3 | `getByRole('textbox', { name: /loan/i })` | "Home Loan Amount" and "Loan Tenure" both match | ambiguous (2 matches) |
| 4 | `locator('input[type="text"]').last()` | The last text box is the comment form's "Name *", not the interest rate | **wrong element**: it still resolves |
| 5 | `getByRole('button', { name: 'Email schedule' })` | There is no e-mail button: only Download PDF, Download Excel Spreadsheet and Share | no match, and there is nothing to heal |

Every value typed through one of these locators is read back through the healthy B3 page object, and the EMI shown is checked against my own amortisation, so a heal that types into the wrong box still fails.

## 1. Detection

Each legacy locator is declared with its **intent**, not just a selector:

```ts
const RATE_BOX: LocatorIntent = {
  key: 'emicalculator.interestRateBox',
  description: 'The number box where the annual interest rate in percent is typed',
  expect: { role: 'textbox', name: 'Interest Rate' },   // the fingerprint
};
this.interestRateBox = healable(page, RATE_BOX, (p) => p.locator('input[type="text"]').last());
```

`resolve()` ([`self-healing/runtime.ts`](../self-healing/runtime.ts)) diagnoses the locator before the test acts on it, and sorts the failure into a class:

| Class | Rule |
|---|---|
| `no-match` | Nothing attached within 5 s. |
| `ambiguous` | More than one match, so any action would violate strict mode. |
| `not-visible` | The only match is hidden. |
| `wrong-element` | One visible match that fails the fingerprint (role, accessible name, text, container). This is the only way to catch case 4. |

Diagnosing at resolution time is better than reading timeouts afterwards: a timeout cannot tell a slow page from a broken locator. The cost is one `count()` per resolve.

On failure an **incident** is written to `<REPORTS_DIR>/<suite>/healing/incidents/<key>.json` with a full-page screenshot beside it. It holds:
- the intent, the fingerprint, the failed locator and its failure class;
- the URL;
- the declaring source line, found from the stack through tsx's source maps;
- Playwright's ARIA snapshot of the page;
- an inventory of candidate elements: role, approximate accessible name, label, test id, and nearest named container.

Detection uses no AI and runs even with healing off.

Out of scope on purpose: an assertion that fails because the *app* is wrong is never "healed". Only locator resolution is. A healer must never fix a test by changing what the test checks.

## 2. Prompt approach

[`self-healing/prompt.ts`](../self-healing/prompt.ts) builds the request.

- **System prompt.** It states the job and six rules:
  - Answer only in the locator vocabulary.
  - Prefer role + accessible name, then label, then test id, then text.
  - The element must serve the *intent*, not merely resemble the old selector.
  - Copy names verbatim.
  - **Return an empty list when nothing on the page serves the intent.**
  - At most 3 candidates, each with a rationale and a confidence.
- **User turn.** Delimited sections: the intent, the expected fingerprint, the failed locator with its match count, the failure class, the ARIA snapshot (up to 12k characters) and the element inventory (up to 160 entries). Only page structure is sent: no cookies, no storage, no network data, no field values.
- **Answer format.** Structured, and data rather than code. With `claude -p` the shape is enforced by `--json-schema`; with the Messages API it is a forced tool call. A locator is `{ by: role|label|placeholder|testid|text, role?, name?, value?, exact?, within? }`. There is no way to express CSS, XPath or `nth()`, and nothing is ever `eval`'d. [`spec.ts`](../self-healing/spec.ts) re-parses every answer against an allow-list of ARIA roles, length limits and known fields, and drops anything else with a recorded reason.
- **Providers.** `HEAL_PROVIDER` selects one; `auto` picks the API if a key is set, then the CLI, then the heuristic.
  - `anthropic`: the Messages API through `@anthropic-ai/sdk`, needs `ANTHROPIC_API_KEY`. With an invalid key it reaches the API, gets `401 authentication_error`, and falls back to the heuristic, which the report labels. **A successful API call was not exercised**, because no API key was available.
  - `claude-cli`: the local Claude Code CLI in print mode, using the developer's existing login. The call is isolated: no tools, no MCP, no user settings or hooks, no CLAUDE.md, no saved session, a temp working directory. Measured overhead is about 1.1k input tokens.
  - `heuristic`: offline and deterministic. It scores inventory elements by bigram similarity to the old selector's strings, overlap with the intent's words, and the fingerprint. It is also the automatic fallback if an LLM call fails, and the report says when that happened.

## 3. Validation before applying

Every candidate from every provider passes through the same deterministic gates ([`validate.ts`](../self-healing/validate.ts)). A gate failure is recorded with its reason.

1. **Vocabulary.** Parsed by `parseSpec`: allowed strategy and role, no positional or raw selectors.
2. **Differs** from the failed locator.
3. **Unique.** Exactly one match.
4. **Visible.**
5. **Fingerprint.** The element has the declared role and name, checked by `locator.and(page.getByRole(role, { name }))` through Playwright's own accessibility engine. It matches the declared text pattern, and it sits inside the declared container (`within`), when one is given.
6. **Replay.** In `heal` mode the scenario continues on the healed locator, and its own assertions decide. Those assertions come from the independent oracle (my own EMI amortisation), so a heal that finds the wrong element still fails. The outcome is recorded as `replay: passed|failed`.
7. **Human review.** A patch is written to `healing/patches/<key>.patch`: a unified diff of the declaring line, applyable with `git apply` (each patch in the committed report passes `git apply --check`). A reviewer-facing `SUGGESTIONS.md` lists the accepted fix, its checks and rationale, every other candidate with its gate results, and cost and latency.

**The tool never edits the source.** In CI the right flow is suggest mode: the build stays red and the patch is attached to it. A person applies the patch in a pull request, and the normal suite proves it. Auto-applying is how a removed feature (case 5) or a real regression gets silently "healed".

| `SELF_HEAL` | Behaviour |
|---|---|
| `off` (default) | Diagnose, write the incident, fail. |
| `suggest` | Also ask the healer, validate, write the patch; still fail. |
| `heal` | Also continue *this run* on the validated locator, so the replay result is known. |

## 4. Results of the committed heal runs (2026-10-07)

`npm test` ends with a heal run on the exercise, using Claude Sonnet through `claude -p`. The offline heuristic was run separately on the same locators for comparison.

| # | Failure | Offline heuristic | Claude Sonnet via `claude -p` | Replay |
|---|---|---|---|---|
| 1 | no-match | `getByRole('textbox', { name: 'Loan Tenure', exact: true })` | `getByRole('textbox', { name: 'Loan Tenure' })` | passed (both) |
| 2 | no-match | `getByRole('link', { name: 'Personal Loan', exact: true })` | same | passed (both) |
| 3 | ambiguous | `getByRole('textbox', { name: 'Home Loan Amount', exact: true })` | same | passed (both) |
| 4 | wrong-element | `getByRole('textbox', { name: 'Interest Rate', exact: true })` | same | passed (both) |
| 5 | no-match | offered no candidate | **returned no candidates** | not run (stays red, as it should) |

- **Claude.** The run took 3.8–5.0 s and $0.004–$0.005 per incident ($0.022 for all five). The cost is the CLI's own `total_cost_usd`, and it varies: an identical run an hour earlier cost $0.243. Why was not investigated. All 4 locators it accepted replayed green. For the e-mail button it returned no candidate at all.
- **Heuristic.** Under 0.1 s per incident. Its report is saved in [`docs/self-healing-runs/heuristic/SUGGESTIONS.md`](self-healing-runs/heuristic/SUGGESTIONS.md).
- **What the validation stopped.** For case 1 the heuristic also offered the **"Home Loan Amount"** box: unique, visible and the right role, but the wrong element. Gate 5 rejected it (`element does not have role textbox named Loan Tenure`). Accepted, it would have typed the tenure into the amount box; the replay, which reads every value back through the healthy page object, would then have failed.
- **Where the result lives.** [`reports/self-healing-healed/healing/SUGGESTIONS.md`](../reports/self-healing-healed/healing/SUGGESTIONS.md), with 4 patches that pass `git apply --check`.

## 5. Evaluation

The healer's accuracy was measured in Section A, with `npm run heal:eval` on its LoanLens web app. That exercise suits an evaluation: the page is the same in every trial, and ground truth comes from the healthy page objects that run its UI suite. emicalculator.net is a live third-party page, so the same harness is not run here. The engine in this folder is the same code. Measured there on 2026-10-07 (84 trials over the five exercise locators and two decoy cases built to offer a plausible wrong answer):
- **0 false heals.** Every removed-feature trial was refused.
- **Claude Sonnet (`claude -p`):** 18/18 correct, both with the fingerprint shown to it and with it withheld.
- **Offline heuristic:** 18/18 with the fingerprint and 6/18 without. Without it, it offered the decoys, and the validator rejected every wrong candidate it offered (42 of 42 in each condition) and no right one.

Section A's [`docs/SELF_HEALING.md`](../../sectionA/docs/SELF_HEALING.md#5-evaluation-how-good-is-the-healer) has the method, the full table and its limits.

## Limitations and next steps

- **Fingerprints are written by hand.** A baseline recorder would remove that work: on every green run, store each locator's resolved role, name, test id and container. The healer could then compare candidates with the last known-good element, not only with a description.
- **Inventory names are approximate** (computed in the page for ranking). Validation always re-resolves through Playwright, so a wrong approximation is rejected, never used.
- **Patches cover only single-line `(p) => …` declarations**, which is the convention the legacy page object follows.
- **LLM answers vary between runs.** The validation is deterministic, and every suggestion records its provider and model.
- **A fingerprint is only as strong as it is specific.** "role: textbox" alone would have let the "Home Loan Amount" box through for case 1, so declare the name.
- **The target is a live third-party page.** If emicalculator.net renames a box, the healthy page objects break too, and the exercise's results change with them; the saved runs record what the page was on the day they ran.
