# AI self-healing locators

The brief asks for 3–5 incorrect or brittle locators, left broken, and an explanation of how an AI could detect, fix and validate them. The locators are broken. There is also a working proof of concept: it detects each failure, asks Claude (or an offline heuristic) for a fix, validates the answer, and writes a patch for a person to review. It never edits the source.

```bash
npm run test:self-healing             # healing off: the 5 scenarios fail with a diagnosis (expected)
npm run heal                          # healing on, provider "auto": validated fixes used for this run only
npm run heal -- --provider heuristic  # offline, no model
npm run heal -- --mode suggest        # propose and validate, but keep the tests red
npm run heal:eval                     # score the healers over repeated trials (section 5)
```

## The five broken locators

They live in [`self-healing/pages/LegacyLocators.ts`](../self-healing/pages/LegacyLocators.ts) and are used only by [`broken-locators.feature`](../self-healing/features/broken-locators.feature) (`@broken-locator`, excluded from the regular suites). Each reproduces a different way locators rot:

| # | Locator | What changed in the app | Failure class |
|---|---|---|---|
| 1 | `getByTestId('kpi-total-loans')` | Per-figure test ids were replaced by one shared `kpi-value` id | no match; the fix needs scoping |
| 2 | `getByRole('button', { name: 'Apply filter', exact: true })` | Button copy became "Apply filters" | no match |
| 3 | `getByLabel('Loan amount')` | A slider was added with the same label as the number box | ambiguous (2 matches) |
| 4 | `locator('table').first()` | The donut chart gained an accessible values table above the recent-loans table | **wrong element**: it still resolves |
| 5 | `getByRole('button', { name: 'Export CSV' })` | The feature was removed | no match, and there is nothing to heal |

Case 4 is the dangerous one. A plain Playwright test would act on the donut's table without complaint and fail later with a confusing assertion, or pass on the wrong data. Case 5 is a trap: a healer that "finds" some other button makes a test pass on a product that lost a feature.

## 1. Detection

Each legacy locator is declared with its **intent**, not just a selector:

```ts
const RECENT_TABLE: LocatorIntent = {
  key: 'dashboard.recentDisbursementsTable',
  description: 'The table of recent disbursements on the dashboard, one row per loan',
  expect: { role: 'table', name: 'Recent disbursements' },   // the fingerprint
};
this.recentDisbursementsTable = healable(page, RECENT_TABLE, (p) => p.locator('table').first());
```

`resolve()` ([`self-healing/runtime.ts`](../self-healing/runtime.ts)) diagnoses the locator before the test acts on it, and sorts the failure into a class:

| Class | Rule |
|---|---|
| `no-match` | Nothing attached within 5 s. |
| `ambiguous` | More than one match, so any action would violate strict mode. |
| `not-visible` | The only match is hidden. |
| `wrong-element` | One visible match that fails the fingerprint (role, accessible name, text, container). This is the only way to catch case 4. |

Diagnosing at resolution time is better than reading timeouts afterwards: a timeout cannot tell a slow page from a broken locator. The cost is one `count()` per resolve.

On failure an **incident** is written to `<section>/reports/<suite>/healing/incidents/<key>.json` with a full-page screenshot beside it. It holds:
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
6. **Replay.** In `heal` mode the scenario continues on the healed locator, and its own assertions decide. Those assertions come from the independent loan-book oracle, so a heal that finds the wrong element still fails. The outcome is recorded as `replay: passed|failed`.
7. **Human review.** A patch is written to `healing/patches/<key>.patch`: a unified diff of the declaring line, applyable with `git apply` (each patch in the committed report passes `git apply --check`). A reviewer-facing `SUGGESTIONS.md` lists the accepted fix, its checks and rationale, every other candidate with its gate results, and cost and latency.

**The tool never edits the source.** In CI the right flow is suggest mode: the build stays red and the patch is attached to it. A person applies the patch in a pull request, and the normal suite proves it. Auto-applying is how a removed feature (case 5) or a real regression gets silently "healed".

| `SELF_HEAL` | Behaviour |
|---|---|
| `off` (default) | Diagnose, write the incident, fail. |
| `suggest` | Also ask the healer, validate, write the patch; still fail. |
| `heal` | Also continue *this run* on the validated locator, so the replay result is known. |

## 4. Results of the committed heal runs (one per section, 2026-10-07)

| # | Failure | Offline heuristic | Claude Sonnet via `claude -p` | Replay |
|---|---|---|---|---|
| 1 | no-match | `getByRole('group', { name: 'Total loans', exact: true }).getByTestId('kpi-value')` | `getByRole('group', { name: 'Total loans' }).getByTestId('kpi-value')` | passed (both) |
| 2 | no-match | `getByRole('button', { name: 'Apply filters', exact: true })` | same | passed (both) |
| 3 | ambiguous | `getByRole('slider', { name: 'Loan amount', exact: true })` | `getByRole('slider', { name: 'Loan amount' })` | passed (both) |
| 4 | wrong-element | `getByRole('table', { name: 'Recent disbursements', exact: true })` | same | passed (both) |
| 5 | no-match | none passed validation | **returned no candidates** | not run (stays red, as it should) |

- **Claude.** Both committed runs gave the answers above, as earlier runs did. Section A's run took 3.5–8.7 s and $0.034–$0.050 per incident ($0.215 for all five); Section B's, a few minutes later, 3.1–4.9 s and $0.0030–$0.0052 ($0.020). The tenfold drop is presumably prompt caching (not verified). For case 3 its rationale in Section B's run reads: *"The slider role with exact name 'Loan amount' is unique, since the other same-named element is a spinbutton."* The locator it returned has no `exact: true`, so the rationale describes a stricter locator than the one it wrote. The locator is still unique, and validation checks the locator, not the rationale.
- **Heuristic.** Under 0.1 s per incident. Its full report is saved in [`docs/self-healing-runs/heuristic/SUGGESTIONS.md`](self-healing-runs/heuristic/SUGGESTIONS.md).
- **What the validation stopped.** For case 5 the heuristic proposed the table's **"Disbursed"** sort button: unique, visible and the right role, but the wrong element. Gate 5 rejected it (`element does not have role button named /export|csv|download/i`). Without the fingerprint, a naive healer would have clicked a sort header and the test would have failed later for a misleading reason. Or, given a looser assertion, it would have passed on a product that lost its export.
- **Where the result lives.** Each section's run heals the same five locators, so there are two reports: [`section-a/reports/self-healing-healed/healing/SUGGESTIONS.md`](../section-a/reports/self-healing-healed/healing/SUGGESTIONS.md) and [`section-b/reports/self-healing-healed/healing/SUGGESTIONS.md`](../section-b/reports/self-healing-healed/healing/SUGGESTIONS.md). One run shows what a heal looks like; section 5 measures how often it is right.

## 5. Evaluation: how good is the healer?

A demo shows that a heal can work. `npm run heal:eval` ([`self-healing/eval.ts`](../self-healing/eval.ts)) measures how often it does, and how it fails. Latest report: [`self-healing/eval-results/EVAL.md`](../self-healing/eval-results/EVAL.md).

- **Ground truth comes from outside the healer.** A heal is *correct* only if the accepted locator resolves to the very DOM element that the healthy page objects in `section-a/loanlens-ui/pages` resolve to. Those page objects run the 56 UI scenarios. For the removed Export CSV feature there is no ground truth; the only correct answer is a refusal.
- **Outcomes.** *Correct*, *missed* (nothing accepted: the test stays red, which is safe), *refused* (correct for the removed feature), and **false heal**: an accepted locator that finds any other element. The script exits 1 on any false heal, because that is the failure that turns a test green for the wrong reason.
- **Two conditions.** *open*: the healer sees the fingerprint, as at runtime. *blind*: the fingerprint is withheld from the healer and used only by the validator. A fingerprint names the role and accessible name, so the open condition partly hands the answer over; blind shows whether the healer can find the element from the intent and the page alone.
- **Separate scores for the model and the guard.** "Top-1 right" scores the provider's first choice before validation. "Wrong candidates rejected" and "right candidates rejected" score the validator as a classifier.

**Two sets of cases.** The *exercise* set is the five broken locators above. The *decoy* set exists only in the evaluation and is built to offer a plausible wrong answer:
- `decoy.loanPrincipalValue`: a renamed test id for a loan's principal figure. Eight chart bars, a legend item and the figure's own group are also named "Principal".
- `decoy.reportsResetButton`: "Clear all filters" was renamed "Reset". The new name shares no word with the old one, while the "Apply filters" button next to it shares one.

Measured on 2026-10-07, 3 trials per case and condition (84 trials):

| Provider | Condition | Correct heals, all cases | Of which decoy cases | False heals | Correct refusals | Top-1 right before validation | Validator: wrong rejected / right rejected | Latency p50 / p95 | Cost per call |
|---|---|---|---|---|---|---|---|---|---|
| Claude Sonnet (`claude -p`) | open | 18/18 | 6/6 | 0 | 3/3 | 18/18 | 0/0 · 0/27 | 4.3 s / 5.5 s | $0.0069 |
| Claude Sonnet (`claude -p`) | blind | 18/18 | 6/6 | 0 | 3/3 | 18/18 | 0/0 · 0/24 | 4.4 s / 4.9 s | $0.0066 |
| heuristic | open | 18/18 | 6/6 | 0 | 3/3 | 12/18 | 42/42 · 0/27 | < 0.1 s | — |
| heuristic | blind | 6/18 | 0/6 | 0 | 3/3 | 3/18 | 42/42 · 0/12 | < 0.1 s | — |

What this says:
- **Claude does not need the fingerprint, and the decoys did not draw it.** It found both decoy targets in all 12 trials, blind included. It never offered a wrong candidate, in either set.
- **The heuristic needs the fingerprint, and the decoys catch it without one.** Blind, its candidates for the principal figure were the "Principal" group itself and the chart legend's "Principal" item. For Reset it offered "Apply filters", the button that shares a word with the old name. Without validation, that last one is a false heal that applies the filters instead of clearing them.
- **The validator stopped every one of those.** It rejected all 42 wrong candidates the heuristic offered in each condition, and no right candidate from either provider. No trial accepted a wrong element.
- **Repeated calls are consistent but not identical.** Claude sometimes adds `exact: true` and sometimes not; both forms resolve to the same element, so agreement across trials is lower than correctness. One Claude answer contained a malformed candidate (outside the locator vocabulary), which was discarded before validation.
- Cost is the CLI's own `total_cost_usd`. It differs between runs of the same prompts (a mean of $0.009 to $0.017 per call on the five exercise cases in an earlier run); why was not investigated.

Limits of this evaluation, stated plainly:
- **Seven cases, written by the same person who wrote the healer.** With 18 healable trials, the 95% Wilson interval on 18/18 is 82–100%. It is a regression check for the healer, not a benchmark.
- **The validator is untested on Claude's answers.** Claude offered no wrong candidate, so the 42-of-42 catch rate is measured on the heuristic only. A harder set, such as a decoy whose name matches the intent better than the target's does, would be the next step.
- **Trials are not independent samples of the world**, only of the model's sampling. The page is the same in every trial.

## Limitations and next steps

- **Fingerprints are written by hand.** A baseline recorder would remove that work: on every green run, store each locator's resolved role, name, test id and container. The healer could then compare candidates with the last known-good element, not only with a description.
- **Inventory names are approximate** (computed in the page for ranking). Validation always re-resolves through Playwright, so a wrong approximation is rejected, never used.
- **Patches cover only single-line `(p) => …` declarations**, which is the convention the legacy page object follows.
- **LLM answers vary between runs.** The validation is deterministic, and every suggestion records its provider and model.
- **A fingerprint is only as strong as it is specific.** "role: button" alone would have let the "Disbursed" button through for case 5, so declare the name. Case 1's fingerprint was "digits only", which in suggest mode (no replay) would accept any other digits-only figure. Measured on today's dashboard, nothing else qualifies: the only other digits-only texts are SVG axis ticks, which the text check already rejects. The fingerprint now also names its container (the "Total loans" group), so that holds by construction, not by the page's current content.
