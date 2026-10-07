@app @api
Feature: LoanLens API - single loan (GET /api/loans/{id})

  Background:
    Given the LoanLens API is up

  Scenario: An existing loan is returned exactly as stored
    When I send a GET request to "/loans/LN-1001"
    Then the response status should be 200
    And the response should match the "loan" schema
    And the loan should equal record "LN-1001" of the loan book
    And the response header "Cache-Control" should be "no-store"

  Scenario Outline: <case>
    When I send a GET request to "<request>"
    Then the response status should be <status>
    And the response should match the "error" schema
    And the error code should be "<code>"

    Examples:
      | case                                  | request              | status | code            |
      | Well-formed id that does not exist    | /loans/LN-9999       | 404    | LOAN_NOT_FOUND  |
      | Lower-case prefix                     | /loans/ln-1001       | 400    | INVALID_ID      |
      | Too many digits                       | /loans/LN-10011      | 400    | INVALID_ID      |
      | Query parameters are not accepted     | /loans/LN-1001?expand=all | 400 | VALIDATION_ERROR |
