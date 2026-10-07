/**
 * Starts the LoanLens app (API + built web UI) for @app scenarios when it is not
 * already running, and stops it again after the run. Set APP_AUTOSTART=false to
 * test an app that is deployed or started elsewhere (APP_BASE_URL decides where).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

let child: ChildProcess | undefined;
let ready: Promise<void> | undefined;

async function isHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${env.app.apiUrl}/health`, { signal: AbortSignal.timeout(1_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export function ensureAppServer(): Promise<void> {
  ready ??= (async () => {
    if (await isHealthy()) return;
    if (!env.app.autoStart) {
      throw new Error(`LoanLens is not reachable at ${env.app.apiUrl} and APP_AUTOSTART=false`);
    }
    child = spawn(process.execPath, ['--import', 'tsx', 'app/server/index.ts'], {
      env: { ...process.env, APP_PORT: String(env.app.port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout?.on('data', (chunk) => (output += chunk));
    child.stderr?.on('data', (chunk) => (output += chunk));
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`LoanLens exited early (code ${child.exitCode}):\n${output}`);
      if (await isHealthy()) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`LoanLens did not become healthy within 20s:\n${output}`);
  })();
  return ready;
}

/** UI scenarios need the built SPA; API scenarios do not. */
export function assertWebBuilt(): void {
  if (!existsSync(path.resolve('app/web/dist/index.html'))) {
    throw new Error('The web UI is not built. Run `npm run build` first (`npm test` does it for you).');
  }
}

export async function stopAppServer(): Promise<void> {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise((r) => child?.once('exit', r));
  }
  child = undefined;
  ready = undefined;
}
