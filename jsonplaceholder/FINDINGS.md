# JSONPlaceholder `POST /posts`: findings

Target: `POST https://jsonplaceholder.typicode.com/posts` (base URL from `JSONPLACEHOLDER_URL`).
Suite: [`create-post.feature`](features/create-post.feature), run by `npm test` or `npm run test:jsonplaceholder`. Every response below was measured on 2026-10-08 and is captured in [`../reports/jsonplaceholder/cucumber-report.html`](../reports/jsonplaceholder/cucumber-report.html).

## Summary

| Brief's input | Scenarios | Expected | Actual |
|---|---|---|---|
| Control: a valid post | 1 | `201`, echoed, id 101 | **Pass** |
| Excessively long strings | 2 | `4xx` (`400`, `413` or `422`) | `201` for 10,000 characters; **`500` with a stack trace** past 10 MiB (JP-01, JP-02) |
| Unsupported special characters | 3 | `4xx` | `201` for a NUL byte and for `<script>` markup; invalid UTF-8 is **silently replaced** (JP-03) |
| Missing required fields | 3 | `4xx` naming the field | `201` without `userId`, without `title`, and for an empty object (JP-04) |
| Wrong field types | 1 | `4xx` naming the field | `201` for `userId: "abc"` (JP-05) |

The 9 failing rows are tagged `@known-defect`: they stay red, and `npm test` counts them as expected only while they fail with the API's own answer, so a timeout or network error is still reported as unexpected. The assertions encode what a correct API would do, not what this one does.

JSONPlaceholder calls itself "the free fake REST API", and its [guide](https://jsonplaceholder.typicode.com/guide/) says of `POST /posts`: "The resource is not really created on the server, but the response is faked as if." So the missing validation is by design for a mock. Against the brief's stated expectation it is still a defect, and the 500 is a defect either way.

---

### JP-01: A title over 10 MiB returns 500 with a stack trace (expected 413)

- **Severity:** High. A server-side failure caused by client input, plus information disclosure.
- **Actual:** `500 Internal Server Error` after about 4 s (4,039 ms in the committed report; 4.0–4.6 s across four runs that day), with the plain-text body `PayloadTooLargeError: request entity too large` and a stack trace exposing `/app/node_modules/body-parser/node_modules/raw-body/index.js`.
- **Cause:** body-parser raises the right error type, but no error handler maps it to its status code.

```bash
python3 -c "import json;print(json.dumps({'title':'A'*10485761,'body':'b','userId':1}))" > big.json
curl -s -w '\nHTTP %{http_code}\n' -X POST https://jsonplaceholder.typicode.com/posts \
  -H 'Content-Type: application/json' --data-binary @big.json | tail -5
```

### JP-02: A 10,000-character title is accepted

- **Severity:** Medium. `201 Created`, with the whole string echoed back. The brief gives no length limit, so this row assumes any sane limit is below 10,000 characters.

### JP-03: Unsupported characters are accepted, and invalid UTF-8 is silently changed

- **Severity:** Medium.
- A title containing NUL (`U+0000`) gets `201` and is echoed back as `"Loan\u0000review"`.
- A title of `<script>alert(1)</script>` gets `201` and is echoed back unchanged. JSON itself is safe, but nothing stops the markup reaching a page that renders titles without escaping.
- **The bytes `FF FE FD`, which can never appear in UTF-8, are replaced with three `U+FFFD` characters (���).** The client gets `201` and its data has been changed without any error. The server does the replacing, not the test's decoder: the raw response bytes are `EF BF BD` three times.

```bash
printf '{"title":"\xff\xfe\xfd","body":"b","userId":1}' | curl -s -X POST https://jsonplaceholder.typicode.com/posts \
  -H 'Content-Type: application/json' --data-binary @- | xxd | head -2
# 00000000: 7b0a 2020 2274 6974 6c65 223a 2022 efbf  {.  "title": "..
# 00000010: bdef bfbd efbf bd22 2c0a 2020 2262 6f64  .......",.  "bod
```

### JP-04: Missing required fields are accepted

- **Severity:** Medium. A post without `userId`, one without `title`, and an empty object `{}` each get `201 Created` and id 101.

### JP-05: A wrong field type is accepted

- **Severity:** Medium. `userId: "abc"` gets `201 Created` and is echoed back as the string `"abc"`, so a client could store a post that points at no user.

## Recommendations

1. Add an error handler that maps body-parser's typed errors to their status codes (`entity.too.large` to 413, `entity.parse.failed` to 400), and never send stack traces to clients. This fixes JP-01.
2. Validate the body against a schema (JSON Schema or zod): required fields, types, maximum lengths, and a character policy that rejects control characters. This fixes JP-02 to JP-05.
3. Reject invalid UTF-8 with `400` instead of replacing it.
