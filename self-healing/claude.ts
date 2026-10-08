/**
 * Asks Claude for replacement locators through the Claude Code CLI in print mode, so it uses the
 * developer's existing login and the repository holds no API key. The call is isolated: no tools,
 * no MCP servers, no user settings or CLAUDE.md, no saved session. The answer is constrained twice,
 * by --json-schema and again by parseSpec's allow-list, because model output is untrusted input.
 */
import { spawn } from 'node:child_process';
import os from 'node:os';
import type { Locator, Page } from 'playwright';

/** The only vocabulary an answer may use. It is data, never code: no CSS, XPath or nth()/first()/last(). */
export type LocatorSpec =
  | { by: 'role'; role: string; name?: string; exact?: boolean; within?: LocatorSpec }
  | { by: 'label' | 'testid' | 'text'; value: string; exact?: boolean; within?: LocatorSpec };

export interface Candidate {
  spec: LocatorSpec;
  rationale: string;
}

export interface ClaudeAnswer {
  candidates: Candidate[];
  /** Entries that were not valid LocatorSpecs, with the reason each was dropped. */
  malformed: { raw: unknown; reason: string }[];
  seconds: number;
  costUsd?: number;
}

export const SYSTEM_PROMPT = `You repair broken Playwright locators in an automated UI test suite.

You receive what the element is for, the locator that failed and why, the page's accessibility tree as a Playwright ARIA snapshot, and the page's data-testid attributes.

Rules:
1. Answer only in the output schema's vocabulary: by "role" (ARIA role and accessible name), "label", "testid" or "text", optionally scoped "within" another locator. CSS, XPath, nth(), first() and last() are not available.
2. Prefer a role with its exact accessible name, then a label, then a test id, then text. Use "within" only to tell apart elements that would otherwise match more than once.
3. The locator must match exactly one element, and that element must serve the stated purpose and fit the expected fingerprint. Do not pick an element only because its text resembles the old locator.
4. Copy roles, names, labels and test ids verbatim from the page. Never invent them.
5. If nothing on the page serves the purpose, return an empty list. "Cannot heal" is better than a guess, because a wrong fix makes the test pass for the wrong reason.
6. Return at most 3 candidates, best first, each with a one-sentence rationale.`;

const LOCATOR = {
  type: 'object',
  properties: {
    by: { type: 'string', enum: ['role', 'label', 'testid', 'text'] },
    role: { type: 'string', description: 'ARIA role, only with by=role' },
    name: { type: 'string', description: 'Exact accessible name, only with by=role' },
    value: { type: 'string', description: 'The label, test id or text, for the other strategies' },
    exact: { type: 'boolean' },
  },
  required: ['by'],
  additionalProperties: false,
} as const;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: { locator: { ...LOCATOR, properties: { ...LOCATOR.properties, within: LOCATOR } }, rationale: { type: 'string' } },
        required: ['locator', 'rationale'],
        additionalProperties: false,
      },
    },
  },
  required: ['candidates'],
  additionalProperties: false,
} as const;

const ROLES = new Set(
  'alert button cell checkbox columnheader combobox definition dialog figure form group heading img link list listitem main navigation option radio region row rowheader slider spinbutton status tab table term textbox'.split(' '),
);

/** Turns one untrusted answer entry into a LocatorSpec, or throws with the reason. */
export function parseSpec(raw: unknown, depth = 0): LocatorSpec {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('locator must be an object');
  if (depth > 1) throw new Error('"within" may be nested only once');
  const r = raw as Record<string, unknown>;
  const text = (field: string) => {
    const v = r[field];
    if (typeof v !== 'string' || !v.trim() || v.length > 120 || /[\r\n]/.test(v)) throw new Error(`${field} must be a short one-line string`);
    return v.trim();
  };
  const extra = { ...(r.exact === true ? { exact: true } : {}), ...(r.within ? { within: parseSpec(r.within, depth + 1) } : {}) };
  if (r.by === 'role') {
    const role = text('role');
    if (!ROLES.has(role)) throw new Error(`"${role}" is not an allowed ARIA role`);
    return { by: 'role', role, ...(r.name ? { name: text('name') } : {}), ...extra };
  }
  if (r.by === 'label' || r.by === 'testid' || r.by === 'text') return { by: r.by, value: text('value'), ...extra };
  throw new Error(`"by" must be role, label, testid or text (got ${JSON.stringify(r.by)})`);
}

export function buildLocator(page: Page, spec: LocatorSpec): Locator {
  const root: Page | Locator = spec.within ? buildLocator(page, spec.within) : page;
  if (spec.by === 'role') return root.getByRole(spec.role as Parameters<Page['getByRole']>[0], { name: spec.name, exact: spec.exact });
  if (spec.by === 'label') return root.getByLabel(spec.value, { exact: spec.exact });
  if (spec.by === 'testid') return root.getByTestId(spec.value);
  return root.getByText(spec.value, { exact: spec.exact });
}

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** The spec as the TypeScript a page object would contain. */
export function specToCode(spec: LocatorSpec): string {
  const base = spec.within ? specToCode(spec.within) : 'page';
  const exact = spec.exact ? ', exact: true' : '';
  if (spec.by === 'role') return spec.name === undefined ? `${base}.getByRole(${quote(spec.role)})` : `${base}.getByRole(${quote(spec.role)}, { name: ${quote(spec.name)}${exact} })`;
  if (spec.by === 'testid') return `${base}.getByTestId(${quote(spec.value)})`;
  return `${base}.${spec.by === 'label' ? 'getByLabel' : 'getByText'}(${quote(spec.value)}${spec.exact ? ', { exact: true }' : ''})`;
}

export function askClaude(prompt: string, model = process.env.HEAL_MODEL || 'sonnet', timeoutMs = 120_000): Promise<ClaudeAnswer> {
  const started = Date.now();
  const args = [
    '-p', '--output-format', 'json', '--model', model,
    '--system-prompt', SYSTEM_PROMPT, '--json-schema', JSON.stringify(OUTPUT_SCHEMA),
    '--tools', '', '--strict-mcp-config', '--setting-sources', 'local', '--disable-slash-commands', '--no-session-persistence',
  ];
  // Started from inside a Claude Code session, the CLI would otherwise think it is nested in one.
  const childEnv = { ...process.env };
  for (const key of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'AI_AGENT']) delete childEnv[key];

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd: os.tmpdir(), env: childEnv, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude -p did not answer within ${timeoutMs / 1000} s`));
    }, timeoutMs);
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`could not run the Claude Code CLI ("claude"): ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const out = JSON.parse(stdout) as { is_error?: boolean; result?: string; structured_output?: unknown; total_cost_usd?: number };
        if (code !== 0 || out.is_error) throw new Error(out.result || stderr || `exit code ${code}`);
        const answer = (out.structured_output ?? JSON.parse(out.result ?? '{}')) as { candidates?: unknown };
        const result: ClaudeAnswer = { candidates: [], malformed: [], seconds: (Date.now() - started) / 1000, costUsd: out.total_cost_usd };
        for (const entry of Array.isArray(answer.candidates) ? answer.candidates : []) {
          const e = entry as { locator?: unknown; rationale?: unknown };
          try {
            result.candidates.push({ spec: parseSpec(e.locator), rationale: String(e.rationale ?? '') });
          } catch (error) {
            result.malformed.push({ raw: entry, reason: (error as Error).message });
          }
        }
        resolve(result);
      } catch (error) {
        reject(new Error(`claude -p failed: ${(error as Error).message.slice(0, 300)}`));
      }
    });
    child.stdin.end(prompt);
  });
}
