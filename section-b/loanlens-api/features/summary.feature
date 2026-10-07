@api-app @api
Feature: LoanLens API - portfolio summary (GET /api/loans/summary)
  The dashboard figures. Totals, the weighted average rate and the monthly EMI
  inflow are recomputed independently from the loan book.

  Background:
    Given the LoanLens API is up

  Scenario Outline: Summary for <case> matches the loan book
    When I send a GET request to "<request>"
    Then the response status should be 200
    And the response should match the "loan summary" schema
    And the summary should match the loan book for that query
    And the type breakdown should add up to the totals
    And the status breakdown should add up to the totals

    Examples:
      | case                         | request                                                     |
      | the whole book               | /loans/summary                                              |
      | two statuses                 | /loans/summary?status=overdue,pending                       |
      | a filter that matches nothing | /loans/summary?type=education&city=Jaipur&status=pending   |

  # Filter validation is shared with GET /api/loans and tested there. What is specific to
  # the summary is that it takes filters only, not the list's paging and sorting.
  Scenario: Summary rejects the list's paging parameters
    When I send a GET request to "/loans/summary?page=2"
    Then the response status should be 400
    And the response should match the "error" schema
    And the error should report "page" as "unknown_parameter"
