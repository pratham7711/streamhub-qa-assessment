#!/usr/bin/env node
/**
 * Runs one Cucumber suite: `node scripts/run-suite.mjs <suite> [extra cucumber args]`.
 * Sets SUITE (so artifacts land in <REPORTS_DIR>/<suite>/), clears that suite's previous
 * artifacts, loads TypeScript through tsx, and tees the console to
 * <REPORTS_DIR>/<suite>/console.log with colour codes stripped. REPORTS_DIR defaults to the
 * git-ignored reports/; `npm run test:section-a|b` sets it to section-<a|b>/reports.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SUITES = ['loanlens-ui', 'loanlens-api', 'jsonplaceholder', 'emicalculator', 'sql', 'self-healing', 'self-healing-healed'];
const [suite, ...rest] = process.argv.slice(2);
// --section a|b picks a section's self-healing exercise; the other suites belong to one section already.
const sectionAt = rest.indexOf('--section');
if (sectionAt >= 0) process.env.SECTION = rest[sectionAt + 1];
const extra = sectionAt >= 0 ? rest.filter((_, i) => i !== sectionAt && i !== sectionAt + 1) : rest;
if (!SUITES.includes(suite) || (process.env.SECTION && !['a', 'b'].includes(process.env.SECTION))) {
  console.error(`Usage: node scripts/run-suite.mjs <${SUITES.join('|')}> [--section a|b] [cucumber args]`);
  process.exit(2);
}

const profile = suite.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const dir = path.join(process.env.REPORTS_DIR ?? 'reports', suite);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const log = createWriteStream(path.join(dir, 'console.log'));
// Section A's suites drive the web app; Section B's API suite calls the API. They are separate servers.
const APP_OF_SUITE = { 'loanlens-ui': 'web', 'loanlens-api': 'api' };
// Section A's self-healing exercise drives the web app; Section B's drives emicalculator.net.
if ((process.env.SECTION ?? 'a') === 'a') Object.assign(APP_OF_SUITE, { 'self-healing': 'web', 'self-healing-healed': 'web' });
const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');
log.write(`# ${suite} — ${new Date().toISOString()} — TEST_ENV=${process.env.TEST_ENV ?? 'local'} — node ${process.version}\n\n`);

// Parallel Cucumber workers would each try to start the app; start it once here.
const server = APP_OF_SUITE[suite] ? await startApp(APP_OF_SUITE[suite]) : undefined;

const child = spawn(
  process.execPath,
  ['--import', 'tsx', 'node_modules/@cucumber/cucumber/bin/cucumber.js', '--profile', profile, ...extra],
  { env: { ...process.env, SUITE: suite, FORCE_COLOR: process.stdout.isTTY ? '1' : '0' }, stdio: ['inherit', 'pipe', 'pipe'] },
);
for (const [stream, out] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
  stream.on('data', (chunk) => {
    out.write(chunk);
    log.write(stripAnsi(chunk.toString()));
  });
}
child.on('exit', (code) => {
  server?.kill('SIGTERM');
  log.end(() => {
    relativisePaths(dir);
    process.exit(code ?? 1);
  });
});

// Stack traces carry the absolute checkout path; committed reports should not. In a git
// worktree whose node_modules is a symlink, frames in dependencies carry the link's target.
function relativisePaths(root) {
  const cwd = process.cwd();
  const modules = path.dirname(realpathSync('node_modules'));
  const prefixes = [...new Set([cwd, modules])];
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.(html|json|xml|log|md|txt)$/.test(entry.name)) continue;
    const file = path.join(entry.parentPath, entry.name);
    const text = readFileSync(file, 'utf8');
    if (prefixes.some((p) => text.includes(p))) writeFileSync(file, prefixes.reduce((t, p) => t.replaceAll(p, '.'), text));
  }
}

async function startApp(name) {
  const web = name === 'web';
  const portVar = web ? 'WEB_PORT' : 'API_PORT';
  const port = process.env[portVar] ?? (web ? '5055' : '5056');
  const probe = web
    ? `${process.env.WEB_BASE_URL ?? `http://localhost:${port}`}/data/loans.json`
    : `${process.env.API_BASE_URL ?? `http://localhost:${port}/api`}/health`;
  const healthy = () => fetch(probe, { signal: AbortSignal.timeout(1000) }).then((r) => r.ok, () => false);
  if (await healthy()) return undefined;
  if (/^(0|false|no|off)$/i.test(process.env.APP_AUTOSTART ?? '')) return undefined;
  const entry = web ? 'section-a/app/server.ts' : 'section-b/api/index.ts';
  const app = spawn(process.execPath, ['--import', 'tsx', entry], { env: { ...process.env, [portVar]: port }, stdio: 'ignore' });
  for (let i = 0; i < 80 && app.exitCode === null; i += 1) {
    if (await healthy()) return app;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.error(`${entry} did not start (exit code ${app.exitCode}); the @${name}-app hooks will report the cause.`);
  app.kill('SIGTERM');
  return undefined;
}
