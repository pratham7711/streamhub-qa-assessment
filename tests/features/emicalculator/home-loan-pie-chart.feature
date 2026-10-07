@ui @external @emicalculator
Feature: emicalculator.net - Test Case 1: Validate the EMI pie chart
  The EMI, total interest and total payment the site shows must equal an
  independent calculation (EMI = P·r·(1+r)^n / ((1+r)^n − 1)), and the
  principal-vs-interest pie chart must be present with two non-zero sections.

  Background:
    Given I launch the EMI calculator application
    When I navigate to the "Home Loan" tab

  Scenario Outline: Scenario <id>: home loan of <amount> at <rate>% for <tenure> years
    When I enter a loan amount of "<amount>", an interest rate of <rate>% and a tenure of <tenure> years
    Then the EMI shown should match my own calculation
    And the total interest and total payment shown should match my own calculation
    And the pie chart should be visible and available
    And both sections of the pie chart should have numerical values greater than zero
    And the pie chart split should match my calculated principal and interest shares

    Examples:
      | id | amount | rate | tenure |
      | A  | 25L    | 10   | 10     |
      | B  | 50L    | 7.5  | 15     |
