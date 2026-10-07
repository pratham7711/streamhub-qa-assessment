import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SourceRef } from './types.js';

const ROOT = process.cwd();
const TEST_CODE = ['self-healing/pages/', 'loanlens-ui/', 'jsonplaceholder/', 'framework/'].map((d) => d.split('/').join(path.sep));

/**
 * Finds the page-object line that declared a healable locator, from the stack
 * at declaration time (tsx maps stack frames back to the .ts source). Only
 * frames in test code count, so the self-healing runtime itself is skipped.
 */
export function callerSource(stack = new Error().stack ?? ''): SourceRef | null {
  for (const frame of stack.split('\n').slice(1)) {
    const m = /\(?((?:file:\/\/)?[^\s()]+?):(\d+):\d+\)?\s*$/.exec(frame.trim());
    if (!m) continue;
    const file = m[1].startsWith('file://') ? fileURLToPath(m[1]) : m[1];
    const rel = path.relative(ROOT, file);
    if (!TEST_CODE.some((d) => rel.startsWith(d)) || rel.includes('node_modules') || !existsSync(file)) continue;
    const line = Number(m[2]);
    const text = readFileSync(file, 'utf8').split('\n')[line - 1] ?? '';
    const arrow = /\((\w+)\)\s*=>\s*(.+)\)\s*[;,]?\s*$/.exec(text);
    return { file: rel.split(path.sep).join('/'), line, text, expression: arrow?.[2].trim() ?? null, param: arrow?.[1] ?? null };
  }
  return null;
}

/**
 * A unified diff that replaces the locator expression on the declaring line, with
 * three lines of context so `git apply` accepts it. Nothing is written to the
 * source: applying it is a reviewer's decision.
 */
export function makePatch(source: SourceRef | null, newExpression: string): string | null {
  if (!source?.expression) return null;
  const abs = path.join(ROOT, source.file);
  const lines = readFileSync(abs, 'utf8').split('\n');
  const idx = source.line - 1;
  if (!lines[idx]?.includes(source.expression)) return null;
  const replaced = lines[idx].replace(source.expression, newExpression);
  const from = Math.max(0, idx - 3);
  const to = Math.min(lines.length, idx + 4);
  const before = lines.slice(from, to);
  const hunk = before.map((l, i) => (from + i === idx ? `-${l}\n+${replaced}` : ` ${l}`)).join('\n');
  return `--- a/${source.file}\n+++ b/${source.file}\n@@ -${from + 1},${before.length} +${from + 1},${before.length} @@\n${hunk}\n`;
}
