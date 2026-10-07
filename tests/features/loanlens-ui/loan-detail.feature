@app @ui @loanlens-ui
Feature: LoanLens UI - Loan detail
  A loan's page restates its record from the loan book and draws its
  repayment by calendar year from the disbursement month. Unknown and
  malformed IDs get a page that says so and offers a way back.

  Scenario: Opening a loan from the report search
    Given I open the LoanLens loan book report
    When I apply these report filters:
      | Borrower or loan ID | LN-1001 |
    And I open loan "LN-1001" from the report
    Then the address bar should show "/loans/LN-1001"
    And the loan detail page should describe loan "LN-1001" exactly as the loan book records it
    And the repayment chart should have one bar per calendar year from the disbursement month
    And every repayment bar should match my own amortisation of the loan
    And the cost of the loan should match my own amortisation
    And I capture evidence "loan LN-1001"

  # Every seeded loan runs whole years, so the "7 yr 6 mo" form is reachable only by changing
  # one field of the API's answer. This is the suite's one stubbed response.
  Scenario: A tenure that is not a whole number of years shows the remaining months
    Given the API answers loan "LN-1001" with a tenure of 90 months
    When I open the LoanLens loan detail page for "LN-1001"
    Then the tenure should read back as 90 monthly payments

  Scenario: The breadcrumb leads back to the report
    Given I open the LoanLens loan detail page for "LN-1001"
    When I follow the "Loan book report" link in the breadcrumb
    Then the address bar should show "/reports"
    And the LoanLens screen heading should be "Loan book report"

  Scenario: An unknown loan ID shows a not-found page
    Given I open the LoanLens loan detail page for "LN-9999"
    Then the LoanLens screen heading should be "Loan not found"
    And the page should say "There is no loan with the ID LN-9999 in the book."
    And I capture evidence "loan not found"
    When I follow the "Search the loan book" link
    Then the address bar should show "/reports"

  # The second row is not valid percent-encoding, so decoding it throws unless the app guards it.
  Scenario Outline: A malformed loan ID explains what an ID looks like: <address>
    Given I open the LoanLens address "<address>"
    Then the LoanLens screen heading should be "Loan not found"
    And the page should say "“<shown>” is not a valid loan ID. Loan IDs look like LN-1047."

    Examples:
      | address          | shown      |
      | /loans/not-a-loan | not-a-loan |
      | /loans/%E0%A4%A  | %E0%A4%A   |
