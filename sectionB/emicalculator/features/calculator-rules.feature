@ui @external @emicalculator
Feature: emicalculator.net - rules that combine inputs
  A decision table over product and EMI scheme, and state transitions of the
  tenure unit (docs/TEST_DESIGN.md). Expected values come from the same
  independent EMI calculation as the other emicalculator tests.

  Scenario: EMI in advance on a car loan is the arrears EMI discounted by one month
    Given I launch the EMI calculator application
    And I navigate to the "Car Loan" tab
    And I enter a loan amount of "6L", an interest rate of 9.5% and a tenure of 4 years
    When I choose "EMI in Advance"
    Then the EMI shown should be the EMI in advance from my own calculation

  Scenario Outline: The EMI scheme is offered only for car loans: <product>
    Given I launch the EMI calculator application
    When I navigate to the "<product>" tab
    Then the "EMI in Advance" option should not be offered

    Examples:
      | product       |
      | Home Loan     |
      | Personal Loan |

  Scenario Outline: Switching the tenure between years and months keeps the same loan: <years> years
    Given I launch the EMI calculator application
    And I navigate to the "Home Loan" tab
    When I type "<years>" into the "Loan Tenure" box and press Tab
    And I switch the tenure to months using the Yr and Mo buttons
    Then the "Loan Tenure" box should show "<months>"
    And the EMI should not have changed
    When I switch the tenure to years using the Yr and Mo buttons
    Then the "Loan Tenure" box should show "<years>"
    And the EMI should not have changed

    Examples:
      | years | months |
      | 0.5   | 6      |
      | 1.75  | 21     |
      | 7     | 84     |
