#!/usr/bin/env node
/**
 * Runs one Cucumber suite: `node scripts/run-suite.mjs <suite> [extra cucumber args]`.
 * Clears that suite's previous reports, starts the web app if it is not already up, loads
 * TypeScript through tsx, and tees the console to <REPORTS_DIR>/<suite>/console.log.
 * Reports go to the git-ignored test-results/, except for `npm test` and `npm run heal`, whose
 * results are the committed evidence in reports/. REPORTS_DIR overrides both.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

// The same run profile the tests read (framework/config/env.ts), so the app starts where the tests look for it.
loadDotenv({ path: path.join('config', 'env', `.env.${process.env.TEST_ENV ?? 'local'}`), quiet: true });

const SUITES = ['loanlens-ui', 'jsonplaceholder', 'self-healing', 'self-healing-healed'];
const [suite, ...extra] = process.argv.slice(2);
if (!SUITES.includes(suite)) {
  console.error(`Usage: node scripts/run-suite.mjs <${SUITES.join('|')}> [cucumber args]`);
  process.exit(2);
}

const reportsDir = process.env.REPORTS_DIR ?? (suite === 'self-healing-healed' ? 'reports' : 'test-results');
const dir = path.join(reportsDir, suite);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const log = createWriteStream(path.join(dir, 'console.log'));
log.write(`# ${suite} — ${new Date().toISOString()} — TEST_ENV=${process.env.TEST_ENV ?? 'local'} — node ${process.version}\n\n`);

const server = suite === 'jsonplaceholder' ? undefined : await startApp();
const child = spawn(
  process.execPath,
  ['--import', 'tsx', 'node_modules/@cucumber/cucumber/bin/cucumber.js', '--profile', suite.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), ...extra],
  {
    env: { ...process.env, REPORTS_DIR: reportsDir, SUITE: suite, FORCE_COLOR: process.stdout.isTTY ? '1' : '0', ...(suite === 'self-healing-healed' ? { SELF_HEAL: 'heal' } : {}) },
    stdio: ['inherit', 'pipe', 'pipe'],
  },
);
for (const [stream, out] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
  stream.on('data', (chunk) => {
    out.write(chunk);
    log.write(chunk.toString().replace(/\u001b\[[0-9;]*m/g, ''));
  });
}
child.on('exit', (code) => {
  server?.kill('SIGTERM');
  log.end(() => {
    // Stack traces carry the absolute checkout path; committed reports should not.
    for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.(html|json|xml|log|md|txt)$/.test(entry.name)) continue;
      const file = path.join(entry.parentPath, entry.name);
      const text = readFileSync(file, 'utf8');
      if (text.includes(process.cwd())) writeFileSync(file, text.replaceAll(process.cwd(), '.'));
    }
    process.exit(code ?? 1);
  });
});

async function startApp() {
  const base = process.env.WEB_BASE_URL;
  if (!base) throw new Error(`WEB_BASE_URL is not set (config/env/.env.${process.env.TEST_ENV ?? 'local'})`);
  const probe = new URL('data/loans.json', base.endsWith('/') ? base : `${base}/`);
  const healthy = () => fetch(probe, { signal: AbortSignal.timeout(1000) }).then((r) => r.ok, () => false);
  if (await healthy()) return undefined;
  if (!['localhost', '127.0.0.1'].includes(probe.hostname)) throw new Error(`Nothing answers at ${base}, and it is not a local URL to start the app on.`);
  const port = probe.port || '80';
  const app = spawn(process.execPath, ['--import', 'tsx', 'app/server.ts'], { env: { ...process.env, WEB_PORT: port }, stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 80 && app.exitCode === null; i += 1) {
    if (await healthy()) return app;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.error(`The web app did not answer at ${probe}; is it built (npm run build)?`);
  app.kill('SIGTERM');
  process.exit(1);
}
