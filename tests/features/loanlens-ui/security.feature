@app @ui @loanlens-ui @security
Feature: LoanLens UI - text from the URL is shown, never run
  Three screens repeat part of the address back to the user: the report's search box, the
  report's note about a bad page number, and the loan-not-found message. Each is a reflected
  XSS sink (OWASP WSTG-INJT-01, WSTG-CLNT-01). The app must escape the text itself; its
  Content-Security-Policy is the second line of defence, so these scenarios also require that
  the policy had nothing to block. Every other LoanLens UI scenario that renders a page fails on a CSP
  violation too.

  Scenario Outline: <sink> shows markup from the URL as text and runs none of it
    Given I open the LoanLens address "<address>"
    Then the page should show "<img src=x onerror=alert(1)>" as plain text
    And no element should have been built from "<img src=x onerror=alert(1)>"
    And no browser dialog should have opened
    And the Content-Security-Policy should not have had to block anything

    Examples:
      | sink                       | address                                              |
      | The report's search box    | /reports?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E   |
      | The report's page note     | /reports?page=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E |
      | The loan-not-found message | /loans/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E      |

  # The page served from disk (/) and the one served by the single-page fallback (/reports)
  # take different routes through the server, so both are checked.
  # Each policy value is compared exactly, directive by directive: a weakened policy such as
  # script-src 'self' 'unsafe-inline' still contains 'self', so a substring check would pass it.
  Scenario Outline: <address> tells the browser not to frame it, sniff it or run outside scripts
    Then the LoanLens page "<address>" should be served with these headers:
      | header                  | directive       | value       |
      | Content-Security-Policy | default-src     | 'self'      |
      | Content-Security-Policy | script-src      | 'self'      |
      | Content-Security-Policy | object-src      | 'none'      |
      | Content-Security-Policy | frame-ancestors | 'none'      |
      | X-Content-Type-Options  |                 | nosniff     |
      | Referrer-Policy         |                 | no-referrer |

    Examples:
      | address  |
      | /        |
      | /reports |

  # The API refuses writes in its own router test; pages are served by a different route.
  Scenario: A page refuses a write method instead of revealing the server's default error page
    When I send a POST request to the LoanLens page "/"
    Then the page response should be a JSON 405 that allows only "GET, HEAD"

  # The web root sits two folders below package.json; an encoded "../" must not climb out of it.
  Scenario: A file outside the web root is never served
    When I send a GET request to the LoanLens page "/..%2f..%2fpackage.json"
    Then the page response should be the app's own page, not "package.json"
