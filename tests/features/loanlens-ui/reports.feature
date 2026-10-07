@app @ui @loanlens-ui
Feature: LoanLens UI - Loan book report
  Filters, sorting and paging live in the URL, so a report can be shared and
  survives a reload. Every list, total and chart is compared with the suite's
  own filtering, sorting and paging of the loan book (tests/utils/loan-book.ts).

  Scenario: The unfiltered report shows the first page of the whole book, newest first
    Given I open the LoanLens loan book report
    Then the report should list exactly the loans the loan book has for the current query
    And the report totals should match the loan book for the current query
    And the "Principal by status" chart should match the loan book for the current query
    And the report should say "Showing 1–10 of 120 loans" and "Page 1 of 12"
    And the "Disbursed" column should be sorted descending
    And the "Previous page" button should be disabled
    And I capture evidence "default report"

  Scenario Outline: Filtering by <description>
    Given I open the LoanLens loan book report
    When I apply these report filters:
      | Loan type           | <type>   |
      | Status              | <status> |
      | City                | <city>   |
      | Min amount (₹)      | <min>    |
      | Max amount (₹)      | <max>    |
      | Borrower or loan ID | <search> |
    Then the address bar should carry exactly those filters
    And the report should list exactly the loans the loan book has for the current query
    And the report totals should match the loan book for the current query
    And the "Principal by status" chart should match the loan book for the current query
    And I capture evidence "filtered by <description>"

    Examples:
      | description              | type     | status | city   | min     | max     | search |
      | home loans that are active | Home   | Active |        |         |         |        |
      | personal loans in Delhi  | Personal |        | Delhi  |         |         |        |
      | an amount range          |          |        |        | 1000000 | 5000000 |        |
      | borrower surname         |          |        |        |         |         | Mehta  |

  Scenario: A shared report URL restores its filters, sort and page
    Given I open the LoanLens loan book report at "?type=home&status=active&sort=amount&page=2"
    Then the "Loan type" filter should show "Home"
    And the "Status" filter should show "Active"
    And the "Amount" column should be sorted ascending
    And the report should list exactly the loans the loan book has for the current query
    And the report totals should match the loan book for the current query
    When I reload the page
    Then the address bar should show "/reports?type=home&status=active&sort=amount&page=2"
    And the report should list exactly the loans the loan book has for the current query

  Scenario: Back and Reset keep the URL and the form in step
    Given I open the LoanLens loan book report
    When I apply these report filters:
      | Loan type | Education |
    Then the address bar should show "/reports?type=education"
    When I go back in the browser history
    Then the address bar should show "/reports"
    And the "Loan type" filter should show "All types"
    And the report should list exactly the loans the loan book has for the current query
    When I go forward in the browser history
    Then the "Loan type" filter should show "Education"
    When I reset the report filters
    Then the address bar should show "/reports"
    And the "Loan type" filter should show "All types"
    And the report should say "Showing 1–10 of 120 loans" and "Page 1 of 12"

  Scenario Outline: Sorting by <column>, header clicked <clicks>
    Given I open the LoanLens loan book report
    When I click the "<column>" column header <clicks>
    Then the "<column>" column should be sorted <direction>
    And no other column should claim a sort order
    And the address bar should show "<url>"
    And the report should list exactly the loans the loan book has for the current query

    Examples:
      | column    | clicks | direction  | url                          |
      | Amount    | once   | descending | /reports?sort=-amount        |
      | Amount    | twice  | ascending  | /reports?sort=amount         |
      | Borrower  | once   | ascending  | /reports?sort=borrower       |
      | Rate      | once   | descending | /reports?sort=-rate          |
      | EMI       | once   | descending | /reports?sort=-emi           |
      | Tenure    | twice  | ascending  | /reports?sort=tenureMonths   |
      | Disbursed | once   | ascending  | /reports?sort=disbursedOn    |

  Scenario: Paging through a sorted report
    Given I open the LoanLens loan book report
    When I click the "Amount" column header once
    And I go to the next page of the report
    Then the address bar should show "/reports?sort=-amount&page=2"
    And the report should say "Showing 11–20 of 120 loans" and "Page 2 of 12"
    And the report should list exactly the loans the loan book has for the current query
    And I capture evidence "sorted page 2"
    When I click the "Rate" column header once
    Then the address bar should show "/reports?sort=-rate"
    And the report should say "Showing 1–10 of 120 loans" and "Page 1 of 12"

  Scenario: The last page disables Next page
    Given I open the LoanLens loan book report at "?page=12"
    Then the report should say "Showing 111–120 of 120 loans" and "Page 12 of 12"
    And the "Next page" button should be disabled
    And the report should list exactly the loans the loan book has for the current query
    When I go to the previous page of the report
    Then the address bar should show "/reports?page=11"

  Scenario: Filters that match nothing show an empty state that explains what to do
    Given I open the LoanLens loan book report
    When I apply these report filters:
      | Status              | Overdue |
      | Borrower or loan ID | Zzyzx   |
    Then the report should show its empty state
    And the report totals should show 0 matching loans
    And I capture evidence "empty state"
    When I clear all filters from the empty state
    Then the address bar should show "/reports"
    And the report should say "Showing 1–10 of 120 loans" and "Page 1 of 12"

  Scenario Outline: A page number that is not a page is explained, and the report starts at page 1: <case>
    Given I open the LoanLens loan book report at "?page=<page>"
    Then the report should note "“<page>” is not a page number, so the report starts at page 1."
    And the report should say "Showing 1–10 of 120 loans" and "Page 1 of 12"

    Examples:
      | case     | page |
      | text     | abc  |
      | zero     | 0    |
      | decimal  | 1.5  |

  Scenario: A page past the end of the report says so and offers the last page
    Given I open the LoanLens loan book report at "?page=9999"
    Then the report should say there is no page "9,999" and that it has 12 pages
    And I capture evidence "page past the end"
    When I go to the last page from that message
    Then the address bar should show "/reports?page=12"
    And the report should say "Showing 111–120 of 120 loans" and "Page 12 of 12"

  Scenario: An impossible amount range is explained instead of silently returning nothing
    Given I open the LoanLens loan book report
    When I apply these report filters:
      | Min amount (₹) | 5000000 |
      | Max amount (₹) | 100000  |
    Then the report should explain that "These filters cannot be applied."
    And the explanation should name the "minAmount" and "maxAmount" filters
    And I capture evidence "invalid range"
