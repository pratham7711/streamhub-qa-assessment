# AI self-healing locators

The brief asks for 3–5 incorrect or brittle locators, left broken, and a description of how AI could heal them: detection, prompt approach, and validation before applying the fix. The five locators below stay broken. A small working proof of concept, [`self-healing/healer.ts`](../self-healing/healer.ts) and [`claude.ts`](../self-healing/claude.ts), detects each failure, asks Claude for a replacement, validates it, and writes the suggestion for a person to review. It never edits the source.

```bash
npm run test:self-healing   # healing off: the 5 scenarios fail with a diagnosis (part of npm test)
npm run heal                # healing on: needs the Claude Code CLI, logged in ($0.011 on the run below)
```

## The broken locators

They live in a "legacy" page object, [`self-healing/pages/LegacyLocators.ts`](../self-healing/pages/LegacyLocators.ts), used only by [`broken-locators.feature`](../self-healing/features/broken-locators.feature).

| # | Locator | What changed in the app | How it fails |
|---|---|---|---|
| 1 | `getByTestId('kpi-total-loans')` | Every key figure now shares one `kpi-value` test id | no match; the fix must be scoped to the right figure |
| 2 | `getByRole('link', { name: 'Calculator', exact: true })` | The navigation link became "EMI calculator" | no match |
| 3 | `getByLabel('Loan amount')` | A slider was added with the same label as the number box | ambiguous: 2 matches |
| 4 | `locator('table').first()` | The donut chart gained a values table above the recent-loans table | **wrong element**: it still finds a table |
| 5 | `getByRole('button', { name: 'Export CSV' })` | The feature was removed | no match, and nothing to heal |

Case 4 is the dangerous one: a plain Playwright test would read the wrong table without complaint. Case 5 is a trap: a healer that "finds" some other button makes a test pass on a product that lost a feature.

## 1. Detection

Each legacy locator is declared with its **intent**: what it is for, and a fingerprint of the element it must find.

```ts
const RECENT_TABLE: LocatorIntent = {
  key: 'dashboard.recentDisbursementsTable',
  description: 'The table of recent disbursements on the dashboard, one row per loan',
  expect: { role: 'table', name: 'Recent disbursements' },
};
this.recentDisbursementsTable = healable(page, RECENT_TABLE, (p) => p.locator('table').first(), scenario);
```

Before a step uses the locator, `resolve()` checks it. **No match** within 5 s, **more than one match**, **hidden**, or **one visible match that fails the fingerprint**, which is the only way to catch case 4. Checking first is better than reading a timeout afterwards, because a timeout cannot tell a slow page from a broken locator. Detection uses no AI and always runs. With healing off, the step fails with that diagnosis.

Only locators are healed. An assertion that fails because the app is wrong is never "healed".

## 2. Prompt approach

- **System prompt** ([`claude.ts`](../self-healing/claude.ts)): answer only in the locator vocabulary; prefer role and accessible name, then label, test id, text; the element must serve the stated purpose, not just resemble the old locator; copy names verbatim; **return an empty list when nothing on the page serves the purpose**; at most 3 candidates, best first.
- **User turn** ([`healer.ts`](../self-healing/healer.ts), `buildPrompt`): the purpose, the fingerprint, the failed locator and why it failed, Playwright's ARIA snapshot of the page, and the page's test ids (which the ARIA snapshot leaves out). No cookies, storage or network data. Each prompt is saved to `healing/prompts/<key>.txt`.
- **Answer format:** data, not code. `--json-schema` makes Claude answer `{ by: role|label|testid|text, role?, name?, value?, exact?, within? }`, so CSS, XPath and `nth()` cannot be expressed, and nothing is `eval`'d. `parseSpec` checks every answer again against an allow-list of strategies and ARIA roles.
- **The call:** `claude -p` through the developer's own Claude Code login, so the repo holds no API key. It runs isolated: no tools, no MCP servers, no settings or CLAUDE.md, no saved session.

## 3. Validation before applying

Every candidate must pass, in order:

1. **Allowed vocabulary** (the schema and `parseSpec`).
2. **A new locator,** not the one that failed.
3. **Exactly one match.**
4. **Visible.**
5. **The fingerprint:** role and accessible name (checked by Playwright's own accessibility engine), the container, and the text pattern, where declared.
6. **Replay:** the scenario continues on the new locator, and its own assertions, whose expected values come from the loan-book oracle, decide whether the fix found the right element.
7. **A person.** Nothing is written to the source. `healing/SUGGESTIONS.md` lists each accepted replacement, every rejected candidate and why, and whether the scenario then passed. Applying it is a code-review decision.

Auto-applying fixes is how a removed feature (case 5) or a real regression gets silently "healed". In CI the right flow is to keep the build red with the suggestion attached.

## 4. Results (2026-10-08, Claude Sonnet via `claude -p`)

| # | How it failed | Claude's replacement (passed validation) | Scenario on the fix |
|---|---|---|---|
| 1 | no match | `getByRole('group', { name: 'Total loans' }).getByTestId('kpi-value')` | passed |
| 2 | no match | `getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'EMI calculator', exact: true })` | passed |
| 3 | ambiguous | `getByRole('slider', { name: 'Loan amount', exact: true })` | passed |
| 4 | wrong element | `getByRole('table', { name: 'Recent disbursements', exact: true })` | passed |
| 5 | no match | **none**: Claude returned an empty list | not run; stays red, as it should |

Claude took 3.2–5.0 s per locator and cost $0.011 for all five (the CLI's own `total_cost_usd`). The reported cost varies between identical runs: an earlier run the same day cost $0.066. Full report: [`reports/self-healing-healed/healing/SUGGESTIONS.md`](../reports/self-healing-healed/healing/SUGGESTIONS.md).

## Limitations

- **Five cases, written by the person who wrote the healer.** This shows the approach on these locators; it is not a benchmark.
- **Fingerprints are written by hand.** Recording each locator's role, name and container on every green run would remove that work.
- **For cases 3 and 4 the fingerprint already names the answer.** It declares a slider called "Loan amount" and a table called "Recent disbursements", so a person could write those fixes from it directly. There, the POC's value is the detection (case 4 is otherwise silent) and the validated suggestion, not the search. Cases 1 and 2 need the page: the new test id and link text are not in the fingerprint.
- **A fingerprint is only as strong as it is specific.** "A button" alone would accept any button for case 5; that is why case 5's fingerprint names the action.
- **Answers vary between runs.** The validation gates are deterministic, so a different answer is either accepted for the same reasons or rejected with a reason.
