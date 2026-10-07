# Mutation check, Section B

Run 2026-10-07T11:31:42.188Z · node v26.7.0 · `npm run test:mutation -- --section b`

Each mutant is a small, realistic bug, written by hand and planted in a temporary copy of LoanLens. The suite that owns that code (loanlens-api, B2) is run against the copy. A mutant counts as killed only if the run completed with the baseline's scenario count and at least one step or After-hook assertion failed. **49 of 49 killed**, 0 equivalent, **0 survived**, 0 did not run cleanly.

| Mutant | Planted bug | Suite | Result | Scenarios that caught it |
|---|---|---|---|---|
| Q01 | Numbers parsed with Number() instead of a strict pattern | loanlens-api | killed | 4: Invalid EMI input - principal with a plus sign; Invalid EMI input - principal in exponent form; Invalid parameter - page is a decimal; … |
| Q02 | Numbers parsed with parseFloat() | loanlens-api | killed | 5: Invalid EMI input - principal in exponent form; Invalid EMI input - principal with a plus sign; Invalid EMI input - rate with a decimal comma; … |
| Q03 | Number pattern not anchored at the end | loanlens-api | killed | 2: Invalid EMI input - principal in exponent form; Invalid EMI input - rate with a decimal comma |
| Q04 | A leading plus sign accepted | loanlens-api | killed | 1: Invalid EMI input - principal with a plus sign |
| Q05 | The sign dropped with Math.abs (emicalculator.net defect EC-01) | loanlens-api | killed | 4: Invalid EMI input - negative rate; Invalid EMI input - negative principal; Invalid EMI input - negative tenure in years; … |
| Q06 | Minimum made exclusive (off by one) | loanlens-api | killed | 3: EMI for 1000 at 10% over 12 months; EMI for 750000 at 0% over 24 months; Across 200 random valid loans, every answer agrees with my own amortisation |
| Q07 | Maximum made exclusive (off by one) | loanlens-api | killed | 9: EMI for 100000000 at 8.5% over 240 months; EMI for 500000 at 50% over 36 months; EMI for 100000000 at 50% over 480 months; … |
| Q08 | Decimal-places limit not enforced (fractions of a paisa) | loanlens-api | killed | 1: Invalid EMI input - fractions of a paisa |
| Q09 | Values not trimmed before validation | loanlens-api | killed | 1: Invalid parameter - search of spaces only |
| Q10 | Unknown-parameter check uses `in` (lets __proto__ and constructor through) | loanlens-api | killed | 1: Invalid parameter - a built-in object name |
| Q11 | Unknown parameters silently ignored | loanlens-api | killed | 7: Invalid EMI input - unknown parameter; Invalid parameter - unknown parameter; Invalid parameter - parameter in the wrong case; … |
| Q12 | A parameter given twice: the first value wins (HTTP parameter pollution) | loanlens-api | killed | 1: Invalid EMI input - principal given twice |
| Q13 | A list filter accepted when only some values are valid | loanlens-api | killed | 1: Invalid parameter - one bad type in a list |
| Q14 | Dates checked by pattern only (2023-02-29 accepted) | loanlens-api | killed | 1: Invalid parameter - impossible calendar date |
| Q15 | Sort strips every leading minus (--amount accepted) | loanlens-api | killed | 1: Invalid parameter - double minus in sort |
| Q16 | Integer parameters accept decimals | loanlens-api | killed | 1: Invalid parameter - page is a decimal |
| E01 | Tenure not required to be a whole number of months | loanlens-api | killed | 2: Invalid EMI input - fractional months; A tenure out of range is explained in months, whatever unit was sent: 0.1 years |
| E02 | Tenure message prints raw floating point ("1.2000000000000002 months") | loanlens-api | killed | 1: A tenure out of range is explained in months, whatever unit was sent: 0.1 years |
| E03 | 480-month limit made exclusive | loanlens-api | killed | 3: EMI for 5000000 at 8.5% over 480 months; EMI for 100000000 at 50% over 480 months; Across 200 random valid loans, every answer agrees with my own amortisation |
| E04 | No special case for a 0% rate (0/0) | loanlens-api | killed | 2: EMI for 750000 at 0% over 24 months; Across 200 random valid loans, every answer agrees with my own amortisation |
| E05 | Monthly rate from a 360-day year | loanlens-api | killed | 16: EMI for 2500000 at 10% over 10 years; EMI for 1000 at 10% over 12 months; EMI for 100000000 at 8.5% over 240 months; … |
| E06 | Payments grouped into the wrong calendar year | loanlens-api | killed | 12: EMI for 2500000 at 10% over 10 years; EMI for 1000 at 10% over 12 months; EMI for 100000000 at 8.5% over 240 months; … |
| E07 | Last instalment not adjusted to clear the balance | loanlens-api | killed | 2: EMI for 100000000 at 50% over 480 months; Across 200 random valid loans, every answer agrees with my own amortisation |
| E08 | Totals rounded to whole rupees instead of paise | loanlens-api | killed | 10: EMI for 2500000 at 10% over 10 years; EMI for 500000 at 0.01% over 36 months; EMI for 500000 at 50% over 36 months; … |
| E09 | Tenure units swapped (years read as months) | loanlens-api | killed | 17: EMI for 2500000 at 10% over 10 years; EMI for 1000 at 10% over 12 months; EMI for 100000000 at 8.5% over 240 months; … |
| E10 | Default start month off by one (getMonth() is zero-based) | loanlens-api | killed | 1: Tenure defaults to years and the start month to the current month |
| E11 | Start month echoed without zero padding ("2026-1") | loanlens-api | killed | 10: EMI for 1000 at 10% over 12 months; EMI for 500000 at 0.01% over 36 months; EMI for 500000 at 50% over 36 months; … |
| L01 | Search made case-sensitive | loanlens-api | killed | 2: Search is case-insensitive returns exactly the matching loans; Search by loan id fragment returns exactly the matching loans |
| L02 | Search text treated as a regular expression | loanlens-api | killed | 1: Regular-expression characters returns exactly the matching loans |
| L03 | Minimum amount made exclusive | loanlens-api | killed | 1: Equal min and max amount returns exactly the matching loans |
| L04 | Inverted rate band not rejected | loanlens-api | killed | 1: Invalid parameter - min rate above max |
| L05 | Monthly EMI inflow counts closed and pending loans too | loanlens-api | killed | 2: Summary for the whole book matches the loan book; Summary for two statuses matches the loan book |
| L06 | Weighted rate divides by zero when nothing matches | loanlens-api | killed | 1: Summary for a filter that matches nothing matches the loan book |
| L07 | Summary accepts the list’s paging and sorting | loanlens-api | killed | 1: Summary rejects the list's paging parameters |
| L08 | Loan ID pattern made case-insensitive | loanlens-api | killed | 1: Lower-case prefix |
| L09 | Loan ID pattern not anchored at the end | loanlens-api | killed | 1: Too many digits |
| L11 | Monthly EMI inflow rounded to whole rupees | loanlens-api | killed | 2: Summary for the whole book matches the loan book; Summary for two statuses matches the loan book |
| L12 | Minimum rate made exclusive | loanlens-api | killed | 1: Rate band, both edges on a loan returns exactly the matching loans |
| L13 | End date made exclusive | loanlens-api | killed | 1: Date window, both edges on a loan returns exactly the matching loans |
| L14 | Each loan's EMI truncated to the paisa instead of rounded | loanlens-api | killed | 3: Each loan carries an EMI derived from its own terms; Summary for the whole book matches the loan book; Summary for two statuses matches the loan book |
| L10 | An empty result reports 0 pages | loanlens-api | killed | 3: Filters that match no loan returns exactly the matching loans; Regular-expression characters returns exactly the matching loans; Longest allowed search, 50 characters returns exactly the matching loans |
| S01 | Broken percent-encoding reaches the generic 500 handler | loanlens-api | killed | 1: A URL with broken percent-encoding is a client error, not a server failure |
| S02 | X-Content-Type-Options: nosniff removed | loanlens-api | killed | 1: An error that repeats the caller's input is served as JSON the browser may not reinterpret |
| S03 | Write methods reach the router | loanlens-api | killed | 1: A write method is refused with 405 and an Allow header |
| S04 | CORS opened to every origin | loanlens-api | killed | 1: A page on another site is not given read access to the API |
| S06 | X-Powered-By: Express announced again (server fingerprint) | loanlens-api | killed | 1: Health check reports the service is up |
| S08 | API responses cacheable (no-store removed) | loanlens-api | killed | 1: An existing loan is returned exactly as stored |
| S09 | No cap on the number of query parameters | loanlens-api | killed | 1: A request with 51 query parameters is refused |
| S11 | A city left out of the filter vocabulary | loanlens-api | killed | 1: The filter vocabulary lists every loan type, status and city in the loan book |
