# JSONPlaceholder `POST /posts`: findings

Target: `POST https://jsonplaceholder.typicode.com/posts` (base URL from `JSONPLACEHOLDER_URL`).
Suite: `npm run test:jsonplaceholder`. Report: `reports/jsonplaceholder/cucumber-report.html`.
Every status below was measured, not assumed. Each finding has at least one automated row, whose captured response is in that report. Inputs marked *(measured once)* were probed with `curl` and then dropped from the suite, because another row of the same partition already catches the same defect.

## Summary

| Area | Scenarios | Passed | Failed | Verdict |
|---|---|---|---|---|
| Controls: valid posts accepted, echoed, not persisted | 4 | 4 | 0 | The client and the endpoint work, so the failures below are about the API's behaviour |
| Robustness: no input causes a 5xx and no internals leak | 14 | 12 | 2 | **2 server-side failures** (JP-01, JP-02) |
| Validation: invalid input gets a 4xx and an error message | 18 | 0 | 18 | **No validation at all** (JP-03 to JP-06) |

JSONPlaceholder calls itself "the free fake REST API", and its [guide](https://jsonplaceholder.typicode.com/guide/) says of `POST /posts`: "The resource is not really created on the server, but the response is faked as if." The validation failures are therefore expected behaviour of a mock. Measured against the brief's stated expectation, though, they are defects, and the suite reports them as such instead of weakening its assertions.

Assumption: the brief gives no length limit, so 255 characters (a common `VARCHAR(255)`) is the assumed maximum title length. A 255-character title is tested as a valid control and 256 as the first invalid value.

---

### JP-01: Payload over 10 MiB returns 500 with a stack trace (expected 413)

- **Severity:** High. A server-side failure plus information disclosure.
- **Steps:** POST a JSON body whose `title` is 10 MiB + 1 character.
- **Expected:** `413 Payload Too Large` with a short JSON error.
- **Actual:** `500 Internal Server Error`, with a plain-text `PayloadTooLargeError: request entity too large` and a stack trace exposing `/app/node_modules/body-parser/node_modules/raw-body/index.js`.
- **Notes:** body-parser raises the right error type, but no error handler maps it to its status code. *(Measured once)* bodies up to 5,000,000 characters are accepted with `201`.

```bash
python3 -c "import json;print(json.dumps({'title':'A'*10485761,'body':'b','userId':1}))" > big.json
curl -s -w '\nHTTP %{http_code}\n' -X POST https://jsonplaceholder.typicode.com/posts \
  -H 'Content-Type: application/json' --data-binary @big.json | tail -5
```

### JP-02: Malformed JSON returns 500 with a stack trace (expected 400)

- **Severity:** High. A server-side failure caused by client input, plus information disclosure.
- **Steps:** POST `{"title": "unterminated` with `Content-Type: application/json`.
- **Expected:** `400 Bad Request` with a JSON error such as `{"error":"Malformed JSON"}`.
- **Actual:** `500 Internal Server Error`, `SyntaxError: Unterminated string in JSON at position 23 (line 1 column 24)` and a stack trace through `/app/node_modules/body-parser/lib/types/json.js`.

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST https://jsonplaceholder.typicode.com/posts \
  -H 'Content-Type: application/json' --data-binary '{"title": "unterminated'
```

### JP-03: Excessively long strings are accepted

- **Severity:** Medium.
- **Expected:** `400`/`413`/`422` for titles over the length limit.
- **Actual:** `201 Created`, with the whole string echoed back, for titles of 256 and 1,000,000 characters, and *(measured once)* for a 10,000-character title and a 1,000,000-character `body`. *(Measured once)* the response time grows with size: about 2.2 s for 1 MB from India, which includes the upload.

### JP-04: Unsupported characters are accepted, and one input is silently corrupted

- **Severity:** Medium (corruption), Low (the rest).
- **Actual:** every probe returns `201 Created` and is echoed back:
  - NUL `\u0000`, and *(measured once)* other C0 control characters, including an ANSI escape sequence (`\u001b[31m`).
  - A lone surrogate `\ud800`. It cannot be encoded in UTF-8, so storing it would fail or corrupt data.
  - **Invalid UTF-8 bytes `FF FE FD` are silently replaced with `U+FFFD` (���).** The client gets `201` and its data has been changed without any error.
  - The `U+202E` right-to-left override (`invoice‮fdp.exe`, a filename-spoofing trick), and *(measured once)* zero-width characters.
  - `'; DROP TABLE posts; --` and *(measured once)* `<script>` are stored verbatim. Storing raw text is acceptable only if every consumer encodes it on output, so these are recorded as observations, not failures.
- **Control:** legitimate Unicode (Devanagari, accented Latin, CJK, emoji) round-trips unchanged, as it should.

### JP-05: Missing required fields are accepted

- **Severity:** Medium.
- **Expected:** `400`/`422` naming the missing field.
- **Actual:** `201 Created` for a missing `userId`, a missing `title`, a missing `body`, `userId: null`, an empty title, and `{}` (automated in the robustness feature only). The empty object returns `{"id": 101}`, so a post with no content gets an id.

### JP-06: Wrong types, impossible values and malformed bodies are accepted or mangled

- **Severity:** Medium.
- **Actual:** all `201 Created`:
  - `userId: "abc"`, `userId: -1` and `userId: 999999` (JSONPlaceholder has users 1 to 10, so referential integrity is not checked).
  - `title: 12345` and `title: {"nested": true}`.
  - **A top-level JSON array is stored as `{"0": {...}, "id": 101}`**, i.e. converted into the wrong shape.
  - *(measured once)* **A form-encoded body is accepted and `userId` comes back as the string `"1"`.** The type is lost.
  - **A valid JSON body sent as `text/plain` returns `{"id": 101}`.** Every field is dropped silently, where `415 Unsupported Media Type` was expected.

## Recommendations

1. Add an error handler that maps body-parser's typed errors (`entity.too.large` to 413, `entity.parse.failed` to 400, and so on). Never send stack traces to clients. This fixes JP-01 and JP-02.
2. Validate the `POST /posts` body against a schema such as JSON Schema or zod: required fields, types, `userId` existence, max lengths, and a character policy that rejects control characters and lone surrogates.
3. Reject request bodies that are not `application/json` with `415`.
4. Reject invalid UTF-8 instead of replacing it.
