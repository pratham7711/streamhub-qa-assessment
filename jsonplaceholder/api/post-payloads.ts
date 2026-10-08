/**
 * Named request bodies for POST /posts. The feature file refers to a payload by name; the
 * exact bytes live here.
 */
import type { PostPayload } from './JsonPlaceholderClient.js';

export type PayloadSpec =
  | { kind: 'json'; payload: PostPayload; note: string }
  | { kind: 'raw'; body: Buffer; contentType: string; note: string };

const valid = { title: 'Quarterly loan book review', body: 'Portfolio notes for Q3.', userId: 1 };
/** body-parser's default JSON limit, which the JSONPlaceholder server uses. */
const TEN_MIB = 10 * 1024 * 1024;

const PAYLOADS: Record<string, PayloadSpec> = {
  'a valid post': { kind: 'json', payload: valid, note: 'title, body and userId all present and well-formed' },
  'a 10,000-character title': { kind: 'json', payload: { ...valid, title: 'A'.repeat(10_000) }, note: '10,000 characters' },
  'a title larger than 10 MiB': { kind: 'json', payload: { ...valid, title: 'A'.repeat(TEN_MIB + 1) }, note: "past the server's 10 MiB JSON limit" },
  'a title with a NUL byte': { kind: 'json', payload: { ...valid, title: 'Loan\u0000review' }, note: 'U+0000 truncates C strings and breaks many databases' },
  // Sent as a Buffer: Playwright JSON-encodes a string body, which would turn these bytes into valid JSON.
  'a title with invalid UTF-8 bytes': {
    kind: 'raw',
    body: Buffer.concat([Buffer.from('{"title":"'), Buffer.from([0xff, 0xfe, 0xfd]), Buffer.from('","body":"b","userId":1}')]),
    contentType: 'application/json',
    note: '0xFF 0xFE 0xFD can never appear in UTF-8',
  },
  'a title with HTML script markup': { kind: 'json', payload: { ...valid, title: '<script>alert(1)</script>' }, note: 'markup that runs wherever the title is rendered unescaped' },
  'a post without userId': { kind: 'json', payload: { title: valid.title, body: valid.body }, note: 'userId omitted' },
  'a post without title': { kind: 'json', payload: { body: valid.body, userId: 1 }, note: 'title omitted' },
  'an empty object': { kind: 'json', payload: {}, note: 'every field omitted' },
  'a userId that is not a number': { kind: 'json', payload: { ...valid, userId: 'abc' }, note: 'userId sent as the string "abc"' },
};

export function payload(name: string): PayloadSpec {
  const spec = PAYLOADS[name];
  if (!spec) throw new Error(`Unknown payload "${name}". Known payloads:\n- ${Object.keys(PAYLOADS).join('\n- ')}`);
  return spec;
}
