@ui @external @emicalculator @negative
Feature: emicalculator.net - what the calculator does with entries it should not accept
  Each row is one test condition from equivalence partitioning and boundary value
  analysis on a box, or from error guessing on formats people really type
  (docs/TEST_DESIGN.md). Each failing partition keeps one row, plus one per way of committing
  the entry (Tab or Enter) where the site behaves differently. Other entries in the same
  partition that fail the same way are listed in the findings, not repeated here. A
  calculator may refuse an entry, by restoring the box or showing a message, or it may
  calculate with exactly what the box shows. It must never quietly calculate with
  something else. Rows tagged @known-defect fail today; each is written up in
  docs/emicalculator-findings.md.

  Background:
    Given I launch the EMI calculator application
    And I navigate to the "Car Loan" tab
    And I enter a loan amount of "6L", an interest rate of 9.5% and a tenure of 4 years

  Scenario Outline: A loan amount written the way people write money is understood: <case>
    When I type "<entry>" into the "Loan Amount" box and press Tab
    Then the "Loan Amount" box should show "<shown>"
    And the results should match my own calculation for the values the boxes show

    Examples: Valid partition, common notations
      | case                   | entry      | shown     |
      | plain digits           | 1500000    | 15,00,000 |
      | Indian grouping        | 15,00,000  | 15,00,000 |
      | rupee sign             | ₹15,00,000 | 15,00,000 |

    Examples: Boundaries of the valid partition
      | case                                  | entry   | shown     |
      | smallest whole amount, ₹1             | 1       | 1         |
      | above the slider's ₹20 lakh maximum   | 5000000 | 50,00,000 |

  Scenario Outline: An invalid loan amount is refused, not reinterpreted: <case>
    When I type "<entry>" into the "Loan Amount" box and press <key>
    Then the calculator should refuse the entry instead of calculating with something else
    And no figure on the calculator should read NaN, Infinity or a negative number

    @known-defect
    Examples: Negative amounts (EC-01)
      | case                             | entry    | key   |
      | negative amount, leaving the box | -2383434 | Tab   |
      | negative amount, pressing Enter  | -2383434 | Enter |

    @known-defect
    Examples: Zero and entries with no digits (EC-02)
      | case                    | entry  | key |
      | zero                    | 0      | Tab |
      | letters only            | abc    | Tab |

    @known-defect
    Examples: Text mixed into digits (EC-03)
      | case                   | entry                        | key   |
      | letters between digits | 12abc34                      | Tab   |

    @known-defect
    Examples: Malformed or oversized numbers (EC-04, EC-08)
      | case                | entry                      | key |
      | two decimal points  | 25.00.000                  | Tab |
      | a 26-digit amount   | 99999999999999999999999999 | Tab |

  Scenario Outline: A valid interest rate is used as typed: <case>
    When I type "<entry>" into the "Interest Rate" box and press Tab
    Then the "Interest Rate" box should show "<shown>"
    And the results should match my own calculation for the values the boxes show

    Examples: Valid partition and boundaries
      | case                           | entry | shown |
      | smallest step, 0.01%           | 0.01  | 0.01  |
      | below the slider's 5% minimum  | 4     | 4     |
      | above the slider's 20% maximum | 25    | 25    |
      | with a percent sign            | 8.5%  | 8.5   |

    @known-defect
    Examples: 0% is a valid rate, as in no-cost EMI offers (EC-06)
      | case          | entry | shown |
      | zero interest | 0     | 0     |

  Scenario Outline: An invalid interest rate is refused, not reinterpreted: <case>
    When I type "<entry>" into the "Interest Rate" box and press Tab
    Then the calculator should refuse the entry instead of calculating with something else
    And no figure on the calculator should read NaN, Infinity or a negative number

    @known-defect
    Examples: Invalid partitions (EC-05, EC-07)
      | case              | entry  |
      | negative rate     | -8.5   |
      | letters           | abc    |
      | decimal comma     | 8,5    |

  Scenario Outline: A valid tenure in years is used as typed: <case>
    When I type "<entry>" into the "Loan Tenure" box and press Tab
    Then the "Loan Tenure" box should show "<entry>"
    And the results should match my own calculation for the values the boxes show

    Examples: Valid partition and boundaries
      | case                                | entry |
      | one year                            | 1     |
      | fractional years                    | 2.5   |
      | above the slider's 7-year maximum   | 10    |

  Scenario Outline: A valid tenure in months is used as typed: <case>
    Given I switch the tenure to months using the Yr and Mo buttons
    When I type "<entry>" into the "Loan Tenure" box and press Tab
    Then the "Loan Tenure" box should show "<entry>"
    And the results should match my own calculation for the values the boxes show

    Examples: Valid partition and boundaries
      | case                 | entry |
      | one month, the floor | 1     |
      | 30 months            | 30    |

  Scenario Outline: An invalid tenure in years is refused, not reinterpreted: <case>
    When I type "<entry>" into the "Loan Tenure" box and press Tab
    Then the calculator should refuse the entry instead of calculating with something else
    And no figure on the calculator should read NaN, Infinity or a negative number

    @known-defect
    Examples: Invalid partitions (EC-05, EC-09)
      | case                          | entry |
      | negative tenure               | -2    |
      | zero                          | 0     |
      | letters                       | abc   |

  Scenario Outline: An invalid tenure in months is refused, not reinterpreted: <case>
    Given I switch the tenure to months using the Yr and Mo buttons
    When I type "<entry>" into the "Loan Tenure" box and press Tab
    Then the calculator should refuse the entry instead of calculating with something else
    And no figure on the calculator should read NaN, Infinity or a negative number

    @known-defect
    Examples: Invalid partitions (EC-05, EC-09)
      | case             | entry |
      | half a month     | 2.5   |
