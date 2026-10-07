@app @ui @broken-locator
Feature: Self-healing exercise - five locators broken on purpose
  These scenarios drive LoanLens through tests/pages/self-healing/LegacyLocators.ts,
  whose locators were broken deliberately and left broken. Each fails in a
  different way: a renamed test id, changed button text, a label that became
  ambiguous, a positional locator that now finds the wrong element, and a
  removed feature.

  npm run test:self-healing   healing off: every scenario fails with a diagnosis
  npm run heal                healing on: validated fixes are used for this run only,
                              and a patch for each is written for review

  The test assertions are the same either way and come from the loan-book
  oracle, so a "healed" locator that finds the wrong element still fails.

  Scenario: Renamed test id - the Total loans figure shows the size of the loan book
    Given I open the LoanLens dashboard
    Then the legacy Total loans figure should equal the number of loans in the loan book

  Scenario: Changed button text - applying a status filter narrows the report
    Given I open the LoanLens loan book report
    When I filter the report to "Overdue" loans with the legacy Apply button
    Then the report should list exactly the loans the loan book has for the current query

  Scenario: Ambiguous label - the loan amount slider updates the number box
    Given I open the LoanLens EMI calculator
    When I set the loan amount to 5000000 with the legacy slider
    Then the number boxes should show 5000000, 10 and 10

  Scenario: Positional locator - the recent disbursements table starts with the newest loan
    Given I open the LoanLens dashboard
    Then the legacy recent disbursements table should start with the most recently disbursed loan

  @unhealable
  Scenario: Removed feature - exporting the report as CSV
    Given I open the LoanLens loan book report
    When I press the legacy Export CSV button
    Then a CSV file of the loans should be downloaded
