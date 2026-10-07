# Self-healing evaluation

Run 2026-10-06T22:23:14.436Z · `npm run heal:eval -- --providers heuristic,claude-cli --modes open,blind --trials 3`

7 cases, 3 trial(s) each, per provider and prompt condition: the exercise's five broken locators (four healable, one removed feature) and 2 harder cases that exist only in this evaluation, where a plausible wrong element is on the page. A heal is **correct** only if the accepted locator resolves to the very element the healthy page objects in `section-a/loanlens-ui/pages` resolve to. A **false heal** is an accepted locator that finds anything else; it is the failure that matters, because it turns a test green for the wrong reason.

**Conditions.** *open*: the healer sees the declared fingerprint (role, name, container), as at runtime. *blind*: the fingerprint is withheld from the healer and used only by the validator.

## Summary

| Provider | Condition | Correct heals (95% CI) | False heals | Missed | Correct refusals | Top-1 right before validation | Wrong candidates rejected | Right candidates rejected | Malformed | Errors | Latency p50 / p95 | Cost per call |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| heuristic | open | 18/18 (82–100%) | **0** | 0 | 3/3 | 12/18 | 42/42 | 0/27 | 0 | 0 | 0.0 s / 0.0 s | — |
| heuristic | blind | 6/18 (16–56%) | **0** | 12 | 3/3 | 3/18 | 42/42 | 0/12 | 0 | 0 | 0.0 s / 0.0 s | — |
| claude-cli (sonnet) | open | 18/18 (82–100%) | **0** | 0 | 3/3 | 18/18 | 0/0 | 0/27 | 1 | 0 | 4.3 s / 5.5 s | $0.0069 |
| claude-cli (sonnet) | blind | 18/18 (82–100%) | **0** | 0 | 3/3 | 18/18 | 0/0 | 0/24 | 0 | 0 | 4.4 s / 4.9 s | $0.0066 |

- **Top-1 right before validation** scores the provider alone. The gap between that column and *Correct heals* is what the validator contributes, by rejecting a wrong first choice and falling through to a right one.
- **Wrong candidates rejected** is the validator's catch rate: of every candidate that pointed at the wrong element, how many it refused. **Right candidates rejected** is its over-strictness.
- The confidence interval is a 95% Wilson interval. With 6 healable cases it is wide on purpose; this is a small fixed eval set, and the cases were written by the same person who wrote the healer.

## Decoy cases only

| Provider | Condition | Correct heals (95% CI) | False heals | Missed | Correct refusals | Top-1 right before validation | Wrong candidates rejected | Right candidates rejected | Malformed | Errors | Latency p50 / p95 | Cost per call |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| heuristic | open | 6/6 (61–100%) | **0** | 0 | 0/0 | 3/6 | 9/9 | 0/9 | 0 | 0 | 0.0 s / 0.0 s | — |
| heuristic | blind | 0/6 (0–39%) | **0** | 6 | 0/0 | 0/6 | 18/18 | 0/0 | 0 | 0 | 0.0 s / 0.0 s | — |
| claude-cli (sonnet) | open | 6/6 (61–100%) | **0** | 0 | 0/0 | 6/6 | 0/0 | 0/11 | 1 | 0 | 4.7 s / 5.5 s | $0.0137 |
| claude-cli (sonnet) | blind | 6/6 (61–100%) | **0** | 0 | 0/0 | 6/6 | 0/0 | 0/9 | 0 | 0 | 4.4 s / 4.6 s | $0.0132 |

- `decoy.loanPrincipalValue`: the loan's principal figure, with eight chart bars, a legend item and the figure's own group also named "Principal".
- `decoy.reportsResetButton`: "Clear all filters" was renamed "Reset", which shares no word with it, while "Apply filters" shares one.

## Per case

| Provider | Condition | Set | Locator | Outcomes | Agreement | Most frequent answer |
|---|---|---|---|---|---|---|
| heuristic | open | exercise | `dashboard.totalLoansValue` | correct 3 | 3/3 | `page.getByRole('group', { name: 'Total loans', exact: true }).getByTestId('kpi-value')` |
| heuristic | open | exercise | `reports.applyFiltersButton` | correct 3 | 3/3 | `page.getByRole('button', { name: 'Apply filters', exact: true })` |
| heuristic | open | exercise | `calculator.loanAmountSlider` | correct 3 | 3/3 | `page.getByRole('slider', { name: 'Loan amount', exact: true })` |
| heuristic | open | exercise | `dashboard.recentDisbursementsTable` | correct 3 | 3/3 | `page.getByRole('table', { name: 'Recent disbursements', exact: true })` |
| heuristic | open | exercise | `reports.exportCsvButton` | refused 3 | 3/3 | `(refused)` |
| heuristic | open | decoy | `decoy.loanPrincipalValue` | correct 3 | 3/3 | `page.getByRole('group', { name: 'Principal', exact: true }).getByTestId('kpi-value')` |
| heuristic | open | decoy | `decoy.reportsResetButton` | correct 3 | 3/3 | `page.getByRole('button', { name: 'Reset', exact: true })` |
| heuristic | blind | exercise | `dashboard.totalLoansValue` | missed 3 | 3/3 | `(missed)` |
| heuristic | blind | exercise | `reports.applyFiltersButton` | correct 3 | 3/3 | `page.getByRole('button', { name: 'Apply filters', exact: true })` |
| heuristic | blind | exercise | `calculator.loanAmountSlider` | correct 3 | 3/3 | `page.getByRole('slider', { name: 'Loan amount', exact: true })` |
| heuristic | blind | exercise | `dashboard.recentDisbursementsTable` | missed 3 | 3/3 | `(missed)` |
| heuristic | blind | exercise | `reports.exportCsvButton` | refused 3 | 3/3 | `(refused)` |
| heuristic | blind | decoy | `decoy.loanPrincipalValue` | missed 3 | 3/3 | `(missed)` |
| heuristic | blind | decoy | `decoy.reportsResetButton` | missed 3 | 3/3 | `(missed)` |
| claude-cli (sonnet) | open | exercise | `dashboard.totalLoansValue` | correct 3 | 3/3 | `page.getByRole('group', { name: 'Total loans' }).getByTestId('kpi-value')` |
| claude-cli (sonnet) | open | exercise | `reports.applyFiltersButton` | correct 3 | 2/3 | `page.getByRole('button', { name: 'Apply filters', exact: true })` |
| claude-cli (sonnet) | open | exercise | `calculator.loanAmountSlider` | correct 3 | 2/3 | `page.getByRole('slider', { name: 'Loan amount' })` |
| claude-cli (sonnet) | open | exercise | `dashboard.recentDisbursementsTable` | correct 3 | 3/3 | `page.getByRole('table', { name: 'Recent disbursements', exact: true })` |
| claude-cli (sonnet) | open | exercise | `reports.exportCsvButton` | refused 3 | 3/3 | `(refused)` |
| claude-cli (sonnet) | open | decoy | `decoy.loanPrincipalValue` | correct 3 | 2/3 | `page.getByRole('group', { name: 'Principal' }).getByTestId('kpi-value')` |
| claude-cli (sonnet) | open | decoy | `decoy.reportsResetButton` | correct 3 | 2/3 | `page.getByRole('button', { name: 'Reset', exact: true })` |
| claude-cli (sonnet) | blind | exercise | `dashboard.totalLoansValue` | correct 3 | 3/3 | `page.getByRole('group', { name: 'Total loans' }).getByTestId('kpi-value')` |
| claude-cli (sonnet) | blind | exercise | `reports.applyFiltersButton` | correct 3 | 3/3 | `page.getByRole('button', { name: 'Apply filters', exact: true })` |
| claude-cli (sonnet) | blind | exercise | `calculator.loanAmountSlider` | correct 3 | 2/3 | `page.getByRole('slider', { name: 'Loan amount' })` |
| claude-cli (sonnet) | blind | exercise | `dashboard.recentDisbursementsTable` | correct 3 | 3/3 | `page.getByRole('table', { name: 'Recent disbursements', exact: true })` |
| claude-cli (sonnet) | blind | exercise | `reports.exportCsvButton` | refused 3 | 3/3 | `(refused)` |
| claude-cli (sonnet) | blind | decoy | `decoy.loanPrincipalValue` | correct 3 | 3/3 | `page.getByRole('group', { name: 'Principal', exact: true }).getByTestId('kpi-value')` |
| claude-cli (sonnet) | blind | decoy | `decoy.reportsResetButton` | correct 3 | 3/3 | `page.getByRole('button', { name: 'Reset', exact: true })` |

*Agreement* is how many trials gave the most frequent answer: a measure of consistency across repeated calls, not of correctness.
