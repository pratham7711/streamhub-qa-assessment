@web-app @ui @loanlens-ui
Feature: LoanLens UI - Portfolio dashboard
  The dashboard summarises the whole loan book. Every figure and chart value
  is compared with the suite's own reading of the loan book
  (framework/oracles/loan-book.ts), never with another figure from the app.

  Background:
    Given I open the LoanLens dashboard

  Scenario: The dashboard loads with its heading, navigation and title
    Then the LoanLens screen heading should be "Portfolio overview"
    And the browser tab title should be "Portfolio overview · LoanLens"
    And the "Dashboard" link in the main navigation should be marked as the current page

  Scenario Outline: The main navigation opens the <screen> screen
    When I follow the "<link>" link in the main navigation
    Then the address bar should show "<path>"
    And the LoanLens screen heading should be "<heading>"
    And the "<link>" link in the main navigation should be marked as the current page

    Examples:
      | screen     | link          | path        | heading           |
      | calculator | EMI calculator | /calculator | EMI calculator    |
      | report     | Reports       | /reports    | Loan book report  |

  Scenario: The key figures match the loan book
    Then the dashboard key figures should match the loan book
    And I capture evidence "dashboard key figures"

  Scenario: The principal-by-type donut reconciles to the total principal
    Then the "Principal by loan type" donut should draw one non-empty slice per loan type with the loan book's principal
    And the slices of the "Principal by loan type" donut should add up to the total in its legend
    And the legend shares of the "Principal by loan type" donut should add up to 100%
    And I capture evidence "principal by loan type"

  Scenario: The status chart shows the loan count of every status
    Then the "Loans by status" chart should show the loan book's count for every status
    And the bars of the "Loans by status" chart should add up to 120 loans

  Scenario: Recent disbursements list the newest loans and link to their detail page
    Then the recent disbursements table should list the 5 most recently disbursed loans
    When I open the most recently disbursed loan from the dashboard
    Then I should be on the detail page of that loan
    And I capture evidence "recent loan detail"
