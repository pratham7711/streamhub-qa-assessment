/**
 * npm run heal [-- --provider auto|claude-cli|anthropic|heuristic] [--mode heal|suggest]
 *
 * Runs the @broken-locator scenarios with self-healing switched on, then prints
 * the validated suggestions. Reports go to reports/self-healing-healed/, the
 * reviewer-facing summary to reports/self-healing-healed/healing/SUGGESTIONS.md.
 * The page objects are never modified; applying a patch is a human decision.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import type { Suggestion } from './types.js';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const mode = option('mode', 'heal');
const provider = option('provider', process.env.HEAL_PROVIDER ?? 'auto');
if (!['heal', 'suggest'].includes(mode)) {
  console.error('--mode must be "heal" or "suggest"');
  process.exit(2);
}

const suite = 'self-healing-healed';
console.log(`Self-healing run: mode=${mode}, provider=${provider}\n`);
const child = spawn(process.execPath, ['scripts/run-suite.mjs', suite], {
  stdio: 'inherit',
  env: { ...process.env, SELF_HEAL: mode, HEAL_PROVIDER: provider },
});
child.on('exit', (code) => {
  const file = `reports/${suite}/healing/suggestions.json`;
  if (!existsSync(file)) {
    console.log('\nNo locator needed healing.');
    process.exit(code ?? 1);
  }
  const suggestions = JSON.parse(readFileSync(file, 'utf8')) as Suggestion[];
  console.log(`\n${'─'.repeat(72)}\nSelf-healing summary (${suggestions.length} broken locators)\n`);
  for (const s of suggestions) {
    console.log(`${s.accepted ? '✔' : '✖'} ${s.key} [${s.kind}]`);
    console.log(`    was:  ${s.brokenLocator}`);
    console.log(`    now:  ${s.accepted ? s.accepted.code : 'no candidate passed validation'}`);
    console.log(`    via:  ${s.provider}${s.providerNote ? ` (${s.providerNote})` : ''}; replay ${s.replay}`);
  }
  console.log(`\nReview: reports/${suite}/healing/SUGGESTIONS.md (patches in reports/${suite}/healing/patches/)`);
  process.exit(code ?? 1);
});
