@app @api
Feature: LoanLens API - EMI calculator (GET /api/emi)
  Required parameters: principal, rate and tenure. Optional: tenureUnit
  (years|months, default years) and startMonth (YYYY-MM). Expected EMIs and
  schedules come from the suite's own amortisation code, not the app's.

  Background:
    Given the LoanLens API is up

  Scenario Outline: EMI for <principal> at <rate>% over <tenure> <unit>
    When I send a GET request to "/emi?principal=<principal>&rate=<rate>&tenure=<tenure>&tenureUnit=<unit>&startMonth=<start>"
    Then the response status should be 200
    And the response should match the "emi" schema
    And the EMI figures should match my own calculation
    And the yearly schedule should match my own amortisation

    Examples: Scenario A of the brief, the same loan as on emicalculator.net
      | principal | rate | tenure | unit   | start   |
      | 2500000   | 10   | 10     | years  | 2026-10 |

    Examples: Boundaries, one parameter at a time
      | principal | rate | tenure | unit   | start   |
      | 1000      | 10   | 12     | months | 2026-01 |
      | 100000000 | 8.5  | 240    | months | 2026-12 |
      | 500000    | 0.01 | 36     | months | 2026-04 |
      | 500000    | 50   | 36     | months | 2026-04 |
      | 5000000   | 8.5  | 1      | months | 2026-07 |
      | 5000000   | 8.5  | 480    | months | 2026-07 |
      | 750000    | 0    | 24     | months | 2026-06 |
      | 300000    | 9.99 | 2.5    | years  | 2026-01 |
      | 100000.55 | 10   | 60     | months | 2026-01 |

    # Every maximum at once: float error is largest here, so this row also guards the tolerance.
    Examples: The corner of the valid domain
      | principal | rate | tenure | unit   | start   |
      | 100000000 | 50   | 480    | months | 2026-01 |

  # Hand-picked rows only test the points someone thought of. This draws loans from the whole
  # valid domain; the seed makes the draw repeatable, and a failure names the loan to replay.
  Scenario: Across 200 random valid loans, every answer agrees with my own amortisation
    When I request the EMI for 200 random valid loans drawn with seed 20261007
    Then every answer should match my own EMI, totals and calendar-year schedule

  Scenario: Tenure defaults to years and the start month to the current month
    When I send a GET request to "/emi?principal=1000000&rate=12&tenure=5"
    Then the response status should be 200
    And the response should match the "emi" schema
    And the EMI figures should match my own calculation
    And the yearly schedule should match my own amortisation

  Scenario: Missing required parameters are all reported
    When I send a GET request to "/emi?rate=12"
    Then the response status should be 400
    And the response should match the "error" schema
    And the error details should name 2 problems
    And the error should report "principal" as "missing"
    And the error should report "tenure" as "missing"

  Scenario Outline: Invalid EMI input - <case>
    When I send a GET request to "<request>"
    Then the response status should be 400
    And the response should match the "error" schema
    And the error code should be "VALIDATION_ERROR"
    And the error should report "<param>" as "<issue>"

    Examples:
      | case                              | request                                                   | param      | issue         |
      | empty principal                   | /emi?principal=&rate=10&tenure=5                          | principal  | missing       |
      | principal below minimum           | /emi?principal=999&rate=10&tenure=5                       | principal  | out_of_range  |
      | principal above maximum           | /emi?principal=100000001&rate=10&tenure=5                 | principal  | out_of_range  |
      | negative rate                     | /emi?principal=100000&rate=-1&tenure=5                    | rate       | out_of_range  |
      | rate just above 50%               | /emi?principal=100000&rate=50.01&tenure=5                 | rate       | out_of_range  |
      | zero tenure                       | /emi?principal=100000&rate=10&tenure=0                    | tenure     | out_of_range  |
      | fractional months                 | /emi?principal=100000&rate=10&tenure=2.5&tenureUnit=months | tenure    | out_of_range  |
      | unknown tenure unit               | /emi?principal=100000&rate=10&tenure=5&tenureUnit=weeks   | tenureUnit | invalid_value |
      | malformed start month             | /emi?principal=100000&rate=10&tenure=5&startMonth=2026-13 | startMonth | invalid_type  |
      | start month with a day            | /emi?principal=100000&rate=10&tenure=5&startMonth=2026-10-01 | startMonth | invalid_type |
      | unknown parameter                 | /emi?principal=100000&rate=10&tenure=5&emi=1              | emi        | unknown_parameter |

    Examples: Hostile and malformed numbers
      | case                              | request                                                   | param      | issue         |
      | negative principal                | /emi?principal=-100000&rate=10&tenure=5                   | principal  | out_of_range  |
      | principal with a plus sign        | /emi?principal=%2B100000&rate=10&tenure=5                 | principal  | invalid_type  |
      | principal in exponent form        | /emi?principal=1e5&rate=10&tenure=5                       | principal  | invalid_type  |
      | fractions of a paisa              | /emi?principal=100000.555&rate=10&tenure=5                | principal  | invalid_type  |
      | principal given twice             | /emi?principal=100000&principal=200000&rate=10&tenure=5   | principal  | duplicate_parameter |
      | rate with a decimal comma         | /emi?principal=100000&rate=8,5&tenure=5                   | rate       | invalid_type  |
      | negative tenure in years          | /emi?principal=100000&rate=10&tenure=-5                   | tenure     | out_of_range  |

  Scenario Outline: A tenure out of range is explained in months, whatever unit was sent: <tenure> <unit>
    When I send a GET request to "/emi?principal=100000&rate=10&tenure=<tenure>&tenureUnit=<unit>"
    Then the response status should be 400
    And the error should report "tenure" as "out_of_range"
    And the error for "tenure" should say "must be a whole number of months between 1 and 480 (got <months> months)"

    Examples:
      | tenure | unit   | months |
      | 41     | years  | 492    |
      | 481    | months | 481    |
      | 0.1    | years  | 1.2    |
