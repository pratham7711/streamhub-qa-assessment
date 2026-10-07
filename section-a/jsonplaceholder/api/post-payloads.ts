/**
 * Named request bodies for the JSONPlaceholder POST /posts scenarios. Feature
 * files refer to a payload by name, so the Gherkin stays readable while the
 * exact bytes live here, in one reviewable place.
 */
import type { PostPayload } from './JsonPlaceholderClient.js';

export type PayloadSpec =
  | { kind: 'json'; payload: PostPayload; note: string }
  | { kind: 'raw'; body: string | Buffer; contentType: string; note: string };

const valid = { title: 'Quarterly loan book review', body: 'Portfolio notes for Q3.', userId: 1 };
const repeat = (n: number) => 'A'.repeat(n);
/** body-parser's default JSON limit on the JSONPlaceholder server is 10 MiB. */
const TEN_MIB = 10 * 1024 * 1024;

export const PAYLOADS: Record<string, PayloadSpec> = {
  // Valid controls: these must be accepted.
  'a valid post': { kind: 'json', payload: valid, note: 'title, body and userId all present and well-formed' },
  'a 255-character title': { kind: 'json', payload: { ...valid, title: repeat(255) }, note: 'common VARCHAR(255) upper bound; should be accepted' },
  'a multilingual title': { kind: 'json', payload: { ...valid, title: 'ऋण समीक्षा — Café Ünïcödé 日本語 ✓ 😀' }, note: 'legitimate Unicode (Devanagari, accents, CJK, emoji) must round-trip unchanged' },

  // Excessively long strings.
  'a 256-character title': { kind: 'json', payload: { ...valid, title: repeat(256) }, note: 'first length past the assumed 255-character limit' },
  'a 1,000,000-character title': { kind: 'json', payload: { ...valid, title: repeat(1_000_000) }, note: '1 MB title' },
  'a title larger than 10 MiB': { kind: 'json', payload: { ...valid, title: repeat(TEN_MIB + 1) }, note: 'body exceeds the server\'s 10 MiB JSON limit' },
  'a title with a NUL byte': { kind: 'json', payload: { ...valid, title: 'Loan\u0000review' }, note: 'U+0000 truncates C strings and breaks many databases' },
  'a title with an unpaired surrogate': { kind: 'raw', body: '{"title":"\\ud800","body":"b","userId":1}', contentType: 'application/json', note: 'lone UTF-16 surrogate: not representable in UTF-8' },
  'a title with invalid UTF-8 bytes': { kind: 'raw', body: Buffer.concat([Buffer.from('{"title":"'), Buffer.from([0xff, 0xfe, 0xfd]), Buffer.from('","body":"b","userId":1}')]), contentType: 'application/json', note: '0xFF 0xFE 0xFD can never appear in UTF-8' },
  'a title with bidirectional overrides': { kind: 'json', payload: { ...valid, title: 'invoice‮fdp.exe' }, note: 'U+202E right-to-left override (filename spoofing)' },
  'a title with SQL meta-characters': { kind: 'json', payload: { ...valid, title: "'; DROP TABLE posts; --" }, note: 'SQL injection probe' },

  // Missing required fields.
  'a post without userId': { kind: 'json', payload: { title: valid.title, body: valid.body }, note: 'userId omitted' },
  'a post without title': { kind: 'json', payload: { body: valid.body, userId: 1 }, note: 'title omitted' },
  'a post without body': { kind: 'json', payload: { title: valid.title, userId: 1 }, note: 'body omitted' },
  'an empty JSON object': { kind: 'json', payload: {}, note: 'no fields at all' },
  'a post with null userId': { kind: 'json', payload: { ...valid, userId: null }, note: 'userId explicitly null' },
  'a post with an empty title': { kind: 'json', payload: { ...valid, title: '' }, note: 'title present but empty' },

  // Wrong types and impossible values.
  'a post with a text userId': { kind: 'json', payload: { ...valid, userId: 'abc' }, note: 'userId must be an integer' },
  'a post with a negative userId': { kind: 'json', payload: { ...valid, userId: -1 }, note: 'ids are positive' },
  'a post with an unknown userId': { kind: 'json', payload: { ...valid, userId: 999_999 }, note: 'JSONPlaceholder has users 1-10' },
  'a post with a numeric title': { kind: 'json', payload: { ...valid, title: 12345 }, note: 'title must be a string' },
  'a post with an object title': { kind: 'json', payload: { ...valid, title: { nested: true } }, note: 'title must be a string' },

  // Malformed requests.
  'malformed JSON': { kind: 'raw', body: '{"title": "unterminated', contentType: 'application/json', note: 'truncated JSON document' },
  'a JSON array instead of an object': { kind: 'raw', body: '[{"title":"t","body":"b","userId":1}]', contentType: 'application/json', note: 'top-level array' },
  'a JSON body sent as text/plain': { kind: 'raw', body: JSON.stringify(valid), contentType: 'text/plain', note: 'valid JSON, wrong Content-Type' },
};

export function payload(name: string): PayloadSpec {
  const spec = PAYLOADS[name];
  if (!spec) throw new Error(`Unknown payload "${name}". Known payloads:\n- ${Object.keys(PAYLOADS).join('\n- ')}`);
  return spec;
}
