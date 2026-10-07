# emicalculator.net: input-handling defects

Measured against the live site on 2026-10-07 (calculator script `calcversion` 4.0), Chromium via Playwright.
Every defect below has at least one `@known-defect` row in [`input-validation.feature`](features/input-validation.feature). Where a defect lists several inputs, the others were measured once by hand and left out of the suite, because the row already fails for the same cause (one row per invalid partition that fails, see [`TEST_DESIGN.md`](../docs/TEST_DESIGN.md#what-was-cut-and-why)).
Each failing loan-amount row names the amount the site actually used, solved from the EMI it shows; the rate and tenure rows name the value the site calculated with.

**The rule the tests apply.** A calculator may *refuse* an entry, by restoring the box or showing a message.
Or it may calculate with *exactly what the box shows*. It must never quietly calculate with something else.
The site has no validation messages at all. Every invalid entry is silently rewritten into some number, and a plan is shown for that number.

## Defects

| ID | Severity | Entry | What the site does |
|---|---|---|---|
| EC-01 | **High** | Loan amount `-2383434` | Drops the minus sign and calculates a ₹23,83,434 loan. After **Tab** the box is rewritten to `23,83,434`. After **Enter** the box still says `-2383434` next to an EMI of ₹1,08,341, which is the EMI of +₹23,83,434. |
| EC-03 | **High** | Loan amount `12abc34` | Strips the letters and joins the digits: calculates ₹1,234. `1e6` becomes ₹16. `<img src=x onerror=alert(1)>` becomes ₹1. After Enter, the box keeps showing the text it ignored. |
| EC-07 | **High** | Interest rate `8,5` | Reads a decimal comma as nothing, so 8,5% becomes **85%**. On a ₹50 lakh loan over 20 years the EMI rises from ₹43,391 to ₹3,54,167, with no warning. `1e1` becomes 11%, `8.5abc` becomes 8.5%. Letters or an empty box become 9%. |
| EC-06 | Medium | Interest rate `0` | Replaces it with **9%**. A 0% rate is a real product ("no-cost EMI"), and the correct EMI is principal ÷ months. |
| EC-02 | Medium | Loan amount `0`, empty, `abc`, `!@#$%`, Devanagari `२५००००` | Treats all of them as ₹0 and shows an EMI of ₹0 with a total payment of ₹0. That is a "plan" for a loan nobody asked for, instead of an error. |
| EC-05 | Medium | Rate `-8.5`, tenure `-2` years, tenure `-24` months | Drops the sign and calculates with 8.5%, 2 years and 24 months. |
| EC-09 | Medium | Tenure `0`, empty, `abc`, `0.01` years; `0` months | Silently replaces each with 1 year (12 months). `2.5` months is rounded to 3 months. |
| EC-04 | Low | Loan amount `25.00.000` | The box shows **`NaN`** and the results show ₹0. |
| EC-08 | Low | Loan amount `99999999999999999999999999` | Accepted, then rewritten as `10,00,00,…,000` (precision lost). There is no upper bound anywhere: 1000% interest and a 5,000-year tenure are calculated too. |

### Reproduce EC-01 by hand

1. Open <https://emicalculator.net/> and choose **Car Loan**.
2. Set the interest rate to 8.5 and the tenure to 2 years.
3. In **Car Loan Amount** type `-2383434` and press **Enter**.
4. The box shows `-2383434` and Loan EMI shows ₹1,08,341. Check by hand: 23,83,434 × r(1+r)²⁴ / ((1+r)²⁴ − 1), with r = 8.5/1200, is ₹1,08,341. That is the EMI of a positive ₹23.8 lakh loan.

## Root cause

Read from the site's own script `wp-content/themes/emicalculator/dist/scripts/emicalculator.js`. The lines below are an excerpt, prettified, with the comments added by me. The tests do not depend on it; it explains the pattern:

```js
l = Math.abs(jQuery("#loanamount").val().replace(/[^\d\.]/g, ""));   // amount: delete every non-digit, then drop the sign
s = Math.abs(jQuery("#loaninterest").val() / 12 / 100);              // rate: drop the sign
r = Math.abs(Math.round(12 * jQuery("#loanterm").val()));            // tenure in years: drop the sign
0 == s && (jQuery("#loaninterest").val(9), (s = 0.0075));            // a 0% rate becomes 9%
0 == r && (jQuery("#loanterm").val(1), (r = 12));                    // a 0 tenure becomes 1 year
```

The boxes are plain `type="text"` inputs with no `pattern`, `min`, `max` or `maxlength`. Only `change` and `blur` are handled. That is why **Enter** (which fires `change` but not `blur`) recalculates without reformatting the box.

**Fix:**
- Validate each box against a strict pattern before calculating.
- Show an inline error and keep the last valid result.
- Never apply `Math.abs` to user input.
- Accept 0% as a valid rate.

## What the site gets right

These have passing tests in the same feature files:
- Indian grouping (`15,00,000`), a leading `₹`, and a trailing `%` are understood. International grouping (`1,500,000`) was also understood when measured once by hand; it is not a test row.
- Values beyond a slider's range (₹50 lakh on the ₹20 lakh car slider, 4% and 25% rates, 10 years) are calculated correctly.
- **EMI in Advance** on a car loan equals the arrears EMI ÷ (1 + r), and the option is offered only for car loans ([`calculator-rules.feature`](features/calculator-rules.feature)).
- Switching tenure between years and months (0.5, 1.75 and 7 years) converts the box and leaves the EMI unchanged.
- HTML typed into a box did not execute when measured once by hand. It is stripped to its digits, which is EC-03; the suite has no HTML row.
