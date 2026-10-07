# Mutation check, Section A

Run 2026-10-07T12:23:42.867Z · node v26.7.0 · `npm run test:mutation -- --section a`

Each mutant is a small, realistic bug, written by hand and planted in a temporary copy of the LoanLens web app. The suite that owns that code (loanlens-ui, A2) is run against the copy. A mutant counts as killed only if the run completed with the baseline's scenario count and at least one step or After-hook assertion failed. **18 of 18 killed**, 0 equivalent, **0 survived**, 0 did not run cleanly.

| Mutant | Planted bug | Suite | Result | Scenarios that caught it |
|---|---|---|---|---|
| S05 | Pages may be framed (clickjacking) | loanlens-ui | killed | 2: / tells the browser not to frame it, sniff it or run outside scripts; /reports tells the browser not to frame it, sniff it or run outside scripts |
| S07 | Inline scripts allowed by the CSP ('unsafe-inline') | loanlens-ui | killed | 2: / tells the browser not to frame it, sniff it or run outside scripts; /reports tells the browser not to frame it, sniff it or run outside scripts |
| S10 | Pages answer write methods (no 405) | loanlens-ui | killed | 1: A page refuses a write method instead of revealing the server's default error page |
| D01 | Monthly rate from a 360-day year | loanlens-ui | killed | 31: A 25L loan at 10% for 10 years from 2026-10; A 18L loan at 9.25% for 30 months from 2026-12; The sliders set the same values as the number boxes; … |
| D02 | Decimal-places limit not enforced (fractions of a paisa) | loanlens-ui | killed | 1: Loan amount in fractions of a paisa shows the validation message on the field |
| D03 | Monthly EMI inflow counts closed and pending loans too | loanlens-ui | killed | 1: The key figures match the loan book |
| D04 | Search made case-sensitive | loanlens-ui | killed | 2: Opening a loan from the report search; Filtering by borrower surname |
| D05 | City filter ignored | loanlens-ui | killed | 1: Filtering by personal loans in Delhi |
| D06 | Sort direction ignored (descending sorts ascend) | loanlens-ui | killed | 12: Recent disbursements list the newest loans and link to their detail page; The unfiltered report shows the first page of the whole book, newest first; Filtering by home loans that are active; … |
| U01 | Text the number box cannot read ("--5") is ignored | loanlens-ui | killed | 1: Keystrokes the browser keeps but cannot read as a number are reported |
| U02 | Exponent notation ("1e6") read as a number | loanlens-ui | killed | 1: Loan amount in exponent notation shows the validation message on the field |
| U03 | A decimal page number ("1.5") treated as a page | loanlens-ui | killed | 1: A page number that is not a page is explained, and the report starts at page 1: decimal |
| U04 | The loan ID from the URL rendered as HTML (reflected XSS) | loanlens-ui | killed | 1: The loan-not-found message shows markup from the URL as text and runs none of it |
| U05 | Rupee figures truncated instead of rounded | loanlens-ui | killed | 31: A 25L loan at 10% for 10 years from 2026-10; A 18L loan at 9.25% for 30 months from 2026-12; The sliders set the same values as the number boxes; … |
| U06 | Dates formatted in a US time zone (shows the day before) | loanlens-ui | killed | 18: Recent disbursements list the newest loans and link to their detail page; Opening a loan from the report search; The unfiltered report shows the first page of the whole book, newest first; … |
| U07 | Stacked bar segments drawn from the axis, not from the segment below | loanlens-ui | killed | 4: A 25L loan at 10% for 10 years from 2026-10; A 18L loan at 9.25% for 30 months from 2026-12; A zero-interest loan repays only the principal; … |
| U08 | Tenure shown without its remaining months ("7 yr" for 90 months) | loanlens-ui | killed | 1: A tenure that is not a whole number of years shows the remaining months |
| U10 | A malformed escape in the loan URL crashes the page title | loanlens-ui | killed | 1: A malformed loan ID explains what an ID looks like: /loans/%E0%A4%A |
