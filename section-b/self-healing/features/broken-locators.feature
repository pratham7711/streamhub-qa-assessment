@ui @external @emicalculator @broken-locator
Feature: Self-healing exercise - five locators on emicalculator.net broken on purpose
  These scenarios drive emicalculator.net through section-b/self-healing/pages/LegacyEmiLocators.ts,
  whose locators were written wrong deliberately and left broken. Each fails in a
  different way: a wrong id, wrong link text, an ambiguous name pattern, a
  positional locator that finds the wrong box, and a feature the page does not have.

  npm run test:self-healing -- --section b   healing off: every scenario fails with a diagnosis
  npm run heal -- --section b                healing on: validated fixes are used for this run only,
                                             and a patch for each is written for review

  The assertions are the same either way. Every value typed through a legacy locator
  is read back through the healthy page object, and the EMI is checked against my own
  amortisation (framework/oracles/emi.ts), so a "healed" locator that finds the wrong
  box still fails.

  Background:
    Given I launch the EMI calculator application

  Scenario: Wrong id - the tenure box sets the loan tenure
    When I type a tenure of 15 years into the legacy tenure box
    Then the EMI shown should match my own calculation

  Scenario: Wrong link text - the Personal Loan tab switches the calculator
    When I open the Personal Loan tab with the legacy tab link
    Then the amount box should be labelled "Personal Loan Amount"

  Scenario: Ambiguous name - the amount box sets the principal
    When I type a loan amount of 2500000 into the legacy amount box
    Then the EMI shown should match my own calculation

  Scenario: Positional locator - the interest rate box sets the rate
    When I type an interest rate of 10.5 into the legacy rate box
    Then the EMI shown should match my own calculation

  @unhealable
  Scenario: Missing feature - e-mailing the repayment schedule
    When I press the legacy Email schedule button
    Then a form to e-mail the schedule should open
