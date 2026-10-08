@web-app @ui @loanlens-ui
Feature: LoanLens UI - EMI calculator
  Expected EMIs, totals and yearly figures come from the suite's own amortisation
  (framework/oracles/emi.ts), so the app cannot agree with itself. The EMI is also
  written out below, rounded to the rupee as the app shows it, so it can be checked by hand.

  Background:
    Given I open the LoanLens EMI calculator

  Scenario Outline: A <amount> loan at <rate>% for <years> years
    When I enter a loan of "<amount>" at <rate>% for <years> years
    Then the monthly EMI should read "<emi>"
    And the monthly EMI, total interest and total payment should match my own calculation
    And the yearly payments chart should show one non-zero bar per loan year
    And every yearly bar should match my own amortisation
    And I capture evidence "<amount> at <rate>% for <years> years"

    Examples:
      | amount | rate | years | emi     |
      | 25L    | 10   | 10    | ₹33,038 |
      | 50L    | 7.5  | 15    | ₹46,351 |
      | 10L    | 12   | 5     | ₹22,244 |

  # Invalid input is refused on its own field, and the old plan is hidden rather than left
  # on screen as if it still applied. Fixing the field brings the right plan back.
  Scenario Outline: <case> is refused
    When I enter a loan of "25L" at 10% for 10 years
    And I type "<value>" into the "<field>" box
    Then the "<field>" box should show the error "<message>"
    And the repayment summary and the chart should be hidden
    And I capture evidence "<case>"
    When I type "<fixed>" into the "<field>" box
    Then the monthly EMI, total interest and total payment should match my own calculation

    Examples:
      | case                         | field       | value    | message                                                            | fixed   |
      | A negative loan amount       | Loan amount | -2383434 | Loan amount must be between ₹1,000 and ₹10,00,00,000.              | 2000000 |
      | An empty loan amount         | Loan amount |          | Enter a loan amount in rupees.                                     | 3000000 |
      | An amount in exponent form   | Loan amount | 1e6      | Loan amount must be written in plain digits, for example 2500000. | 2000000 |
      | A tenure longer than 40 years | Loan tenure | 50       | Loan tenure must be a whole number of years between 1 and 40.      | 20      |
