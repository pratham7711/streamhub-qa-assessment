@ui @external @emicalculator
Feature: emicalculator.net - Test Case 2: Validate the EMI bar chart
  The values are set by dragging the sliders, not by typing. The yearly bar
  chart and its tooltips are checked against an independent month-by-month
  amortisation grouped into calendar years.

  Scenario: Personal loan of 10L at 12% for 5 years, schedule starting in a chosen month
    Given I launch the EMI calculator application
    When I navigate to the "Personal Loan" tab
    And I use the sliders to set the loan amount to "10L", the interest rate to 12% and the tenure to 5 years
    And I change the schedule start month to "Mar 2027" using the calendar widget
    Then the EMI shown should match my own calculation
    And the bar chart should be visible and available
    And the bar chart should have one bar per calendar year of the repayment schedule
    And the tooltip of every bar should show values that match my own amortisation
