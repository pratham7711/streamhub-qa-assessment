@api @external @jsonplaceholder
Feature: JSONPlaceholder POST /posts - invalid input is rejected with a 4xx
  Brief A3, first half: invalid input should get "the appropriate HTTP error
  codes or error messages". Valid controls come first, so a failure below
  cannot be blamed on a broken client or a dead endpoint.

  JSONPlaceholder is documented as a fake API: it validates nothing and stores
  nothing. The rejection scenarios are therefore expected to FAIL. Each failure
  is a reproducible finding, written up in docs/jsonplaceholder-findings.md.

  Background:
    Given the JSONPlaceholder posts endpoint is reachable

  @control
  Scenario Outline: Control - <payload> is accepted and echoed
    When I create "<payload>"
    Then the post should be created with id 101
    And the created post should echo every submitted field unchanged
    And the response time should be under 10 seconds

    Examples:
      | payload               |
      | a valid post          |
      | a 255-character title |
      | a multilingual title  |

  @control
  Scenario: Control - created posts are not persisted (documented fake behaviour)
    When I create "a valid post"
    And I fetch the post with id 101
    Then the response status should be 404

  @known-defect
  Scenario Outline: <payload> is rejected
    When I create "<payload>"
    Then the API should reject the request with a 4xx client error
    And the response should explain what is wrong

    Examples: Excessively long strings
      | payload                     |
      | a 256-character title       |
      | a title larger than 10 MiB  |

    Examples: Unsupported special characters
      | payload                              |
      | a title with a NUL byte              |
      | a title with an unpaired surrogate   |
      | a title with invalid UTF-8 bytes     |
      | a title with bidirectional overrides |

    Examples: Missing required fields
      | payload                   |
      | a post without userId     |
      | a post without title      |
      | a post without body       |
      | a post with null userId   |
      | a post with an empty title |

    Examples: Wrong types, impossible values and malformed requests
      | payload                            |
      | a post with a text userId          |
      | a post with a negative userId      |
      | a post with an unknown userId      |
      | a post with a numeric title        |
      | malformed JSON                     |
      | a JSON array instead of an object  |
      | a JSON body sent as text/plain     |
