@app @ui @loanlens-ui
Feature: LoanLens UI - EMI calculator
  The calculator sends the form to /api/emi and draws the answer. Expected
  EMIs, totals and calendar-year schedules come from the suite's own
  amortisation (tests/utils/emi.ts), so the UI cannot agree with itself.

  Background:
    Given I open the LoanLens EMI calculator

  Scenario Outline: A <amount> loan at <rate>% for <tenure> <unit> from <start>
    When I enter a loan of "<amount>" at <rate>% for <tenure> <unit> with the first EMI in "<start>"
    Then the monthly EMI, total interest and total payment should match my own calculation
    And the payment break-up donut should split the total payment into principal and total interest
    And the slices of the "Break-up of total payment" donut should add up to the total in its legend
    And the yearly payments chart should have one bar per calendar year of my own schedule
    And every yearly bar should match my own calendar-year amortisation
    And the yearly amortisation table should match my own calendar-year amortisation
    And I capture evidence "calculated <amount> at <rate>% for <tenure> <unit>"

    Examples: Scenario A of the brief
      | amount | rate | tenure | unit  | start   |
      | 25L    | 10   | 10     | years | 2026-10 |

    Examples: Tenure entered in months
      | amount | rate | tenure | unit   | start   |
      | 18L    | 9.25 | 30     | months | 2026-12 |

  Scenario: A zero-interest loan repays only the principal
    When I enter a loan of "6L" at 0% for 24 months with the first EMI in "2027-01"
    Then the monthly EMI, total interest and total payment should match my own calculation
    And the monthly EMI should be "₹25,000" and the total interest "₹0"
    And the payment break-up donut should draw the principal as its only slice
    And the yearly payments chart should have one bar per calendar year of my own schedule
    And every yearly bar should match my own calendar-year amortisation
    And I capture evidence "zero interest loan"

  Scenario: The sliders set the same values as the number boxes
    When I use the sliders' keyboard controls to set a loan of "10L" at 12% for 5 years
    Then the number boxes should show 1000000, 12 and 5
    And the monthly EMI, total interest and total payment should match my own calculation
    And the yearly payments chart should have one bar per calendar year of my own schedule

  Scenario: Switching the tenure unit converts the tenure without changing the EMI
    When I enter a loan of "25L" at 10% for 10 years with the first EMI in "2026-10"
    And I switch the tenure unit to "months"
    Then the "Loan tenure" box should contain "120"
    And the monthly EMI, total interest and total payment should match my own calculation

  Scenario: A bar tooltip opens on hover and on keyboard focus
    When I enter a loan of "10L" at 12% for 5 years with the first EMI in "2027-03"
    And I hover over the "2028" bar of the yearly payments chart
    Then the chart tooltip should show the 2028 principal, interest and total from my own schedule
    And I capture evidence "tooltip on hover"
    When I move the pointer away from the chart
    Then no chart tooltip should be open
    When I move keyboard focus to the "2027" bar of the yearly payments chart
    Then the chart tooltip should show the 2027 principal, interest and total from my own schedule
    And the focused bar should be described by the tooltip
    When I press Tab
    Then the chart tooltip should show the 2028 principal, interest and total from my own schedule
    And I capture evidence "tooltip on keyboard focus"

  Scenario Outline: <field> <case> shows the validation message on the field
    When I enter a loan of "25L" at 10% for 10 years with the first EMI in "2026-10"
    And I type "<value>" into the "<field>" box
    Then the "<field>" box should show the error "<message>"
    And the repayment summary should ask me to fix the highlighted field
    And the yearly chart and amortisation table should be hidden
    And I capture evidence "validation <field> <case>"
    When I type "<fixed>" into the "<field>" box
    Then the monthly EMI, total interest and total payment should match my own calculation

    # The range rules, negatives included, live in the API and are tested there one by one.
    # The UI's job is to put the API's refusal on the right field in the field's own words,
    # which is worded differently for each field, so there is one row per field.
    Examples: Out-of-range values, refused by the API and shown on the field
      | field         | case              | value    | message                                                                          | fixed   |
      | Loan amount   | negative          | -2383434 | Loan amount must be between ₹1,000 and ₹10,00,00,000.                            | 2000000 |
      | Interest rate | negative          | -8.5     | Interest rate must be between 0% and 50%.                                        | 9       |
      | Loan tenure   | over 40 years     | 50       | Loan tenure must be a whole number of months between 1 and 480 (got 600 months). | 20      |

    Examples: A required value left empty, caught before any request
      | field         | case              | value | message                                                                          | fixed   |
      | Loan amount   | left empty        |       | Enter a loan amount in rupees.                                                   | 3000000 |


    Examples: A notation a number box allows but money does not, caught before any request
      | field         | case                      | value       | message                                                            | fixed   |
      | Loan amount   | in exponent notation      | 1e6         | Loan amount must be written in plain digits, for example 2500000. | 2000000 |

  # A number box keeps "--5" but reports an empty value, and React's onChange never fires
  # for it. Without the app's own check the box would say --5 while the plan stayed stale.
  Scenario: Keystrokes the browser keeps but cannot read as a number are reported
    When I enter a loan of "25L" at 10% for 10 years with the first EMI in "2026-10"
    And I clear the "Loan amount" box and press the keys "--5"
    Then the "Loan amount" box should show the error "Loan amount must be a number."
    And the repayment summary should ask me to fix the highlighted field
    And I capture evidence "keys two minus signs"

  # The browser drops letters, so the box shows 1234 and the plan is for ₹1,234. This fails
  # if the box ever stops being a number box and letters reach the calculation.
  Scenario: Letters typed between digits never reach the amount box
    When I enter a loan of "25L" at 10% for 10 years with the first EMI in "2026-10"
    And I clear the "Loan amount" box and press the keys "12abc34"
    Then the "Loan amount" box should contain "1234"
    And the monthly EMI, total interest and total payment should match my own calculation

  Scenario: The summary shows a busy state while a new plan is calculated
    When I enter a loan of "25L" at 10% for 10 years with the first EMI in "2026-10"
    And the EMI service starts answering slowly
    And I type "3000000" into the "Loan amount" box
    Then the repayment summary should be marked as busy
    And I capture evidence "recalculating"
    And the monthly EMI, total interest and total payment should match my own calculation
