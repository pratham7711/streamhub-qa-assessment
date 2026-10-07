@api-app @api
Feature: LoanLens API - list loans (GET /api/loans)
  Filtering, search, sorting and pagination over the mock loan book. Every
  successful response is checked against an independent oracle that reads the
  mock database file and applies the documented query rules itself.

  Background:
    Given the LoanLens API is up

  Scenario Outline: <case> returns exactly the matching loans
    When I send a GET request to "<request>"
    Then the response status should be 200
    And the response should match the "loan list" schema
    And the response should contain exactly the loans the loan book has for that query

    # Every range edge below equals a real loan's value (8.95% x6, 10% LN-1041, 2024-01-01 LN-1094,
    # 2024-12-12, ₹15.6 lakh LN-1001), so an inclusive bound turned exclusive changes the result.
    Examples: Single parameters
      | case                          | request                                          |
      | Defaults (page 1, newest)     | /loans                                           |
      | Filter by one type            | /loans?type=home                                 |
      | Filter by one status          | /loans?status=overdue                            |
      | Filter by city                | /loans?city=Mumbai                               |
      | Minimum amount only           | /loans?minAmount=5000000                         |
      | Rate band, both edges on a loan | /loans?minRate=8.95&maxRate=10                 |
      | Date window, both edges on a loan | /loans?disbursedFrom=2024-01-01&disbursedTo=2024-12-12 |
      | Equal min and max amount      | /loans?minAmount=1560000&maxAmount=1560000       |
      | Search is case-insensitive    | /loans?q=SHARMA                                  |
      | Search by loan id fragment    | /loans?q=LN-110                                  |

    Examples: Combinations, sorting and paging
      | case                                   | request                                                            |
      | Multi-value type and status            | /loans?type=home,car&status=active                                 |
      | Repeated type parameter is merged      | /loans?type=home&type=car                                          |
      | Amount band sorted ascending           | /loans?minAmount=1000000&maxAmount=5000000&sort=amount             |
      | Sort by EMI descending                 | /loans?type=personal&sort=-emi                                     |
      | Alphabetical borrowers, second page    | /loans?sort=borrower&page=2&pageSize=25                            |
      | Largest allowed page size              | /loans?pageSize=100                                                |
      | Last partial page                      | /loans?pageSize=50&page=3                                          |
      | Every filter at once                   | /loans?type=home,personal&status=active,overdue&city=Delhi,Mumbai&minAmount=100000&maxAmount=20000000&minRate=7&maxRate=18&disbursedFrom=2023-01-01&disbursedTo=2025-12-31&sort=-amount&pageSize=5 |

    Examples: Edges that are valid but return nothing
      | case                                   | request                                                            |
      | Last allowed page, past the end, is empty | /loans?type=education&page=10000                                |
      | Filters that match no loan             | /loans?type=education&status=pending&city=Jaipur                   |

    Examples: Search is a literal substring match, at its length limits
      | case                                   | request                                                            |
      | Regular-expression characters          | /loans?q=.*                                                        |
      | Shortest allowed search, 2 characters  | /loans?q=ab                                                        |
      | Longest allowed search, 50 characters  | /loans?q=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa |

  # A second, independent oracle: sortedness is checked directly, not by re-sorting the book.
  # Fields and directions already ordered exactly by a row above are not repeated here.
  Scenario Outline: Sorting by <field> <direction>
    When I send a GET request to "/loans?sort=<sort>&pageSize=100"
    Then the response status should be 200
    And the returned loans should be sorted by <field> <direction>

    Examples:
      | sort          | field       | direction  |
      | rate          | rate        | ascending  |
      | -tenureMonths | tenureMonths | descending |
      | disbursedOn   | disbursedOn | ascending  |

  Scenario: Each loan carries an EMI derived from its own terms
    When I send a GET request to "/loans?pageSize=100"
    Then the response status should be 200
    And the page should hold 100 loans
    And every loan should carry the EMI computed from its own amount, rate and tenure

  Scenario Outline: Invalid parameter - <case>
    When I send a GET request to "<request>"
    Then the response status should be 400
    And the response should match the "error" schema
    And the error code should be "VALIDATION_ERROR"
    And the error should report "<param>" as "<issue>"

    Examples: Out of range
      | case                       | request                                   | param     | issue        |
      | page zero                  | /loans?page=0                             | page      | out_of_range |
      | page above maximum         | /loans?page=10001                         | page      | out_of_range |
      | page size above maximum    | /loans?pageSize=101                       | pageSize  | out_of_range |
      | page size zero             | /loans?pageSize=0                         | pageSize  | out_of_range |
      | negative amount            | /loans?minAmount=-5                       | minAmount | out_of_range |
      | rate just above 50%        | /loans?maxRate=50.01                      | maxRate   | out_of_range |
      | one-character search       | /loans?q=a                                | q         | out_of_range |
      | 51-character search        | /loans?q=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | q | out_of_range |
      | search of spaces only      | /loans?q=%20%20%20                        | q         | out_of_range |

    Examples: Unsupported types and values
      | case                       | request                                   | param         | issue          |
      | page is a decimal          | /loans?page=1.5                           | page          | invalid_type   |
      | amount in scientific form  | /loans?minAmount=1e6                      | minAmount     | invalid_type   |
      | impossible calendar date   | /loans?disbursedFrom=2023-02-29           | disbursedFrom | invalid_type   |
      | end date with month 13     | /loans?disbursedTo=2024-13-01             | disbursedTo   | invalid_type   |
      | non-ISO date               | /loans?disbursedFrom=01/02/2024           | disbursedFrom | invalid_type   |
      | unknown loan type          | /loans?type=boat                          | type          | invalid_value  |
      | one bad type in a list     | /loans?type=home,boat                     | type          | invalid_value  |
      | unknown city               | /loans?city=Atlantis                      | city          | invalid_value  |
      | unsupported sort field     | /loans?sort=interest                      | sort          | invalid_value  |
      | double minus in sort       | /loans?sort=--amount                      | sort          | invalid_value  |

    Examples: Contradictory or unknown parameters
      | case                       | request                                   | param         | issue               |
      | min amount above max       | /loans?minAmount=5000000&maxAmount=100    | minAmount     | invalid_range       |
      | min rate above max         | /loans?minRate=12&maxRate=9               | minRate       | invalid_range       |
      | from date after to date    | /loans?disbursedFrom=2025-01-01&disbursedTo=2024-01-01 | disbursedFrom | invalid_range |
      | unknown parameter          | /loans?colour=red                         | colour        | unknown_parameter   |
      | parameter in the wrong case | /loans?pagesize=5                        | pagesize      | unknown_parameter   |
      | a built-in object name     | /loans?__proto__=x                        | __proto__     | unknown_parameter   |

  Scenario: All problems in one request are reported together
    When I send a GET request to "/loans?page=0&pageSize=500&sort=foo&colour=red"
    Then the response status should be 400
    And the response should match the "error" schema
    And the error details should name 4 problems
    And the error should report "page" as "out_of_range"
    And the error should report "pageSize" as "out_of_range"
    And the error should report "sort" as "invalid_value"
    And the error should report "colour" as "unknown_parameter"
