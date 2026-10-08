@web-app @ui @loanlens-ui
Feature: LoanLens UI - Portfolio dashboard
  The dashboard summarises the loan book. Every expected figure comes from the
  suite's own reading of the data file (framework/oracles/loan-book.ts), never
  from the app.

  Background:
    Given I open the LoanLens dashboard

  Scenario: The dashboard loads with its heading, key figures and recent loans
    Then the LoanLens screen heading should be "Portfolio overview"
    And the browser tab title should be "Portfolio overview · LoanLens"
    And the dashboard key figures should match the loan book
    And the recent disbursements table should list the 5 most recently disbursed loans
    And I capture evidence "dashboard"

  Scenario: The principal-by-type donut shows every loan type's principal
    Then the "Principal by loan type" donut should draw one non-zero slice per loan type with the loan book's principal
    And the "Principal by loan type" donut's legend should total the loan book's principal

  Scenario: The main navigation opens the EMI calculator
    When I follow the "EMI calculator" link in the main navigation
    Then the address bar should show "/calculator"
    And the LoanLens screen heading should be "EMI calculator"
