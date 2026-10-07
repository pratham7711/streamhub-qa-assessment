@app @api
Feature: LoanLens API - service basics
  The API is read-only, speaks JSON on every path (including errors), and
  rejects methods and routes it does not serve with a structured error body.

  Scenario: Health check reports the service is up
    When I send a GET request to "/health"
    Then the response status should be 200
    And the response should be JSON
    And the response should match the "health" schema
    And the response should not carry the header "X-Powered-By"

  # The Reports filters are built from this list, so a value missing here cannot be filtered on.
  Scenario: The filter vocabulary lists every loan type, status and city in the loan book
    When I send a GET request to "/meta"
    Then the response status should be 200
    And the response should match the "meta" schema
    And the vocabulary should list exactly the loan types, statuses and cities of the loan book

  Scenario: An unknown route returns a JSON 404, not an HTML page
    When I send a GET request to "/does-not-exist"
    Then the response status should be 404
    And the response should match the "error" schema
    And the error code should be "ROUTE_NOT_FOUND"

  # One middleware refuses every method but GET and HEAD, so one write method proves it.
  Scenario: A write method is refused with 405 and an Allow header
    When I send a POST request to "/loans"
    Then the response status should be 405
    And the response header "Allow" should be "GET, HEAD"
    And the response should match the "error" schema
    And the error code should be "METHOD_NOT_ALLOWED"

  @security
  Scenario: An error that repeats the caller's input is served as JSON the browser may not reinterpret
    When I send a GET request to "/loans/LN-1%3Cscript%3E"
    Then the response status should be 400
    And the response should be JSON
    And the response header "X-Content-Type-Options" should be "nosniff"

  @security
  Scenario: A page on another site is not given read access to the API
    When I send a GET request to "/loans" from a page on "https://attacker.example"
    Then the response status should be 200
    And the response should not carry the header "Access-Control-Allow-Origin"

  @security
  Scenario: A URL with broken percent-encoding is a client error, not a server failure
    When I send a GET request to "/loans/%E0%A4%A"
    Then the response status should be 400
    And the response should match the "error" schema
    And the error code should be "MALFORMED_URL"

  # Node's query-string parser silently drops every pair after the 1,000th, so a bad value
  # placed after them would never be validated. The API refuses more than 50 pairs instead.
  @security
  Scenario: A request with 50 query parameters, the most allowed, is accepted
    When I send a GET request to "/loans/summary" with "type=home" repeated 50 times
    Then the response status should be 200

  @security
  Scenario: A request with 51 query parameters is refused
    When I send a GET request to "/loans/summary" with "type=home" repeated 51 times
    Then the response status should be 400
    And the response should match the "error" schema
    And the error code should be "TOO_MANY_PARAMETERS"
