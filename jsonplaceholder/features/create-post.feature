@api @jsonplaceholder
Feature: JSONPlaceholder POST /posts with boundary and invalid data
  Brief A3: invalid input should get an HTTP error code or an error message, without a
  server-side failure. JSONPlaceholder documents itself as a fake that validates nothing,
  so the invalid rows are expected to fail. Each failure is written up in
  jsonplaceholder/FINDINGS.md.

  Scenario: A valid post is created
    When I create "a valid post"
    Then the post should be created with id 101
    And the created post should echo every submitted field

  @known-defect
  Scenario Outline: <payload> is rejected without a server error
    When I create "<payload>"
    Then the API should answer with a 4xx client error, not accept it or fail

    Examples: Excessively long strings
      | payload                    |
      | a 10,000-character title   |
      | a title larger than 10 MiB |

    Examples: Unsupported special characters
      | payload                          |
      | a title with a NUL byte          |
      | a title with invalid UTF-8 bytes |
      | a title with HTML script markup  |

    Examples: Missing required fields
      | payload               |
      | a post without userId |
      | a post without title  |
      | an empty object       |

    Examples: Wrong field types
      | payload                       |
      | a userId that is not a number |
