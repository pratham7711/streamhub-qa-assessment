import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import { buildUserPrompt, OUTPUT_SCHEMA, SYSTEM_PROMPT } from '../prompt.js';
import type { HealProvider, Incident, ProviderResult } from '../types.js';
import { readCandidates } from './llm-output.js';

export function claudeCliAvailable(): boolean {
  return spawnSync('claude', ['--version'], { stdio: 'ignore', timeout: 10_000 }).status === 0;
}

/**
 * Asks Claude through the locally installed Claude Code CLI in print mode, so it
 * uses whatever login the developer already has and needs no API key in the repo.
 * The call is isolated: no tools, no MCP servers, no user settings or hooks, no
 * CLAUDE.md, no saved session, run from a temp directory. Structured output is
 * enforced with --json-schema, and the answer is still re-validated by parseSpec.
 */
export function claudeCli(model = process.env.HEAL_MODEL || 'sonnet', timeoutMs = 120_000): HealProvider {
  const name = `claude-cli (${model})`;
  return {
    name,
    suggest(incident: Incident): Promise<ProviderResult> {
      const started = Date.now();
      const args = [
        '-p', '--output-format', 'json', '--model', model,
        '--system-prompt', SYSTEM_PROMPT, '--json-schema', JSON.stringify(OUTPUT_SCHEMA),
        '--tools', '', '--strict-mcp-config', '--setting-sources', 'local', '--disable-slash-commands', '--no-session-persistence',
      ];
      const childEnv = { ...process.env };
      for (const key of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'AI_AGENT']) delete childEnv[key];

      return new Promise((resolve, reject) => {
        const child = spawn('claude', args, { cwd: os.tmpdir(), env: childEnv, stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`claude -p did not answer within ${timeoutMs / 1000}s`));
        }, timeoutMs);
        child.stdout.on('data', (c) => (stdout += c));
        child.stderr.on('data', (c) => (stderr += c));
        child.on('error', (e) => {
          clearTimeout(timer);
          reject(e);
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          try {
            const out = JSON.parse(stdout) as { is_error?: boolean; result?: string; structured_output?: unknown; total_cost_usd?: number };
            if (code !== 0 || out.is_error) throw new Error(out.result || stderr || `exit ${code}`);
            const answer = out.structured_output ?? JSON.parse(out.result ?? '{}');
            resolve({ provider: name, ...readCandidates(answer, name), durationMs: Date.now() - started, costUsd: out.total_cost_usd });
          } catch (error) {
            reject(new Error(`claude -p failed: ${(error as Error).message.slice(0, 300)}`));
          }
        });
        child.stdin.end(buildUserPrompt(incident));
      });
    },
  };
}
