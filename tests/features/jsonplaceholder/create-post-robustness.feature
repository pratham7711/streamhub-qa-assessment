@api @external @jsonplaceholder
Feature: JSONPlaceholder POST /posts - no input causes a server-side failure
  Brief A3: "The API should respond with the appropriate HTTP error codes or
  error messages for invalid inputs without encountering server-side failures."
  This feature checks the second half of that sentence: whatever we send, the
  server must answer with a non-5xx status, and must not expose internals.
  Each row is a different way to crash a server (size, encoding, injection, a missing
  or mistyped field, the wrong body shape or type). Payloads that carry no extra risk
  of a crash are only in the validation feature.

  Background:
    Given the JSONPlaceholder posts endpoint is reachable

  Scenario Outline: <payload> does not cause a server error
    When I create "<payload>"
    Then the API should not fail with a server error
    And the response should not leak implementation details

    Examples: Excessively long strings
      | payload                     |
      | a 1,000,000-character title |

    Examples: Unsupported special characters
      | payload                              |
      | a title with a NUL byte              |
      | a title with an unpaired surrogate   |
      | a title with invalid UTF-8 bytes     |
      | a title with SQL meta-characters     |

    Examples: Missing required fields
      | payload                   |
      | a post without userId     |
      | an empty JSON object      |
      | a post with null userId   |

    Examples: Wrong types and malformed requests
      | payload                            |
      | a post with a text userId          |
      | a post with an object title        |
      | a JSON array instead of an object  |
      | a JSON body sent as text/plain     |

    @known-defect
    Examples: Known server-side failures (docs/jsonplaceholder-findings.md JP-01, JP-02)
      | payload                    |
      | a title larger than 10 MiB |
      | malformed JSON             |
