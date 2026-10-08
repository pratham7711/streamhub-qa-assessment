@web-app @ui @broken-locator
Feature: Self-healing exercise - five locators broken on purpose
  These scenarios drive the LoanLens web app through self-healing/pages/LegacyLocators.ts,
  whose locators were broken deliberately and left broken. Each fails in a different way.

  npm run test:self-healing   healing off: every scenario fails with a diagnosis
  npm run heal                Claude proposes fixes; validated ones are used for this run
                              only and written to healing/SUGGESTIONS.md for review

  The assertions are the same either way and come from the loan-book oracle, so a
  "healed" locator that finds the wrong element still fails.

  Scenario: Renamed test id - the Total loans figure shows the size of the loan book
    Given I open the LoanLens dashboard
    Then the legacy Total loans figure should equal the number of loans in the loan book

  Scenario: Changed link text - the main navigation opens the EMI calculator
    Given I open the LoanLens dashboard
    When I open the EMI calculator with the legacy navigation link
    Then the LoanLens screen heading should be "EMI calculator"

  Scenario: Ambiguous label - the loan amount slider updates the number box
    Given I open the LoanLens EMI calculator
    When I set the loan amount to 5000000 with the legacy slider
    Then the "Loan amount" box should contain "5000000"

  Scenario: Positional locator - the recent disbursements table starts with the newest loan
    Given I open the LoanLens dashboard
    Then the legacy recent disbursements table should start with the most recently disbursed loan

  @unhealable
  Scenario: Removed feature - exporting the loan book as CSV
    Given I open the LoanLens dashboard
    When I press the legacy Export CSV button
    Then a CSV file of the loans should be downloaded
