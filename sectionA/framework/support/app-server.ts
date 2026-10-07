/**
 * Starts the LoanLens web app when @web-app scenarios need it and it is not already running,
 * and stops it again after the run. Set APP_AUTOSTART=false to test a copy that is deployed
 * or started elsewhere (WEB_BASE_URL decides where).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

/** The app reads the mock data in `dataFile`; the oracle reads the same file. */
export const APP = {
  label: 'LoanLens web app',
  entry: 'app/server.ts',
  dataFile: 'app/public/data/loans.json',
  portVar: 'WEB_PORT',
  port: env.web.port,
  probe: `${env.web.baseUrl}/data/loans.json`,
};

let child: ChildProcess | undefined;
let ready: Promise<void> | undefined;

async function isHealthy(): Promise<boolean> {
  try {
    const res = await fetch(APP.probe, { signal: AbortSignal.timeout(1_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export function ensureAppServer(): Promise<void> {
  ready ??= (async () => {
    if (await isHealthy()) return;
    if (!env.autoStart) {
      throw new Error(`${APP.label} is not reachable at ${APP.probe} and APP_AUTOSTART=false`);
    }
    const started = spawn(process.execPath, ['--import', 'tsx', APP.entry], {
      env: { ...process.env, [APP.portVar]: String(APP.port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child = started;
    let output = '';
    started.stdout?.on('data', (chunk) => (output += chunk));
    started.stderr?.on('data', (chunk) => (output += chunk));
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (started.exitCode !== null) throw new Error(`${APP.label} exited early (code ${started.exitCode}):\n${output}`);
      if (await isHealthy()) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`${APP.label} did not become healthy within 20s:\n${output}`);
  })();
  return ready;
}

/** The web app serves a build. */
export function assertWebBuilt(): void {
  if (!existsSync(path.resolve('app/dist/index.html'))) {
    throw new Error('The web app is not built. Run `npm run build` first (`npm test` does it for you).');
  }
}

export async function stopAppServer(): Promise<void> {
  if (child && child.exitCode === null) {
    const running = child;
    running.kill('SIGTERM');
    await new Promise((r) => running.once('exit', r));
  }
  child = undefined;
  ready = undefined;
}
