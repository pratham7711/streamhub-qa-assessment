/**
 * Starts the app a scenario needs when it is not already running, and stops it again after
 * the run: @web-app scenarios get the Section A web app, @api-app scenarios the Section B API.
 * The two are separate servers on separate ports. Set APP_AUTOSTART=false to test a copy
 * that is deployed or started elsewhere (WEB_BASE_URL and API_BASE_URL decide where).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

export type AppName = 'web' | 'api';

/** Each app reads its own copy of the mock data (`dataFile`); the oracle reads the same copy. */
export const APPS: Record<AppName, { label: string; entry: string; dataFile: string; portVar: string; port: number; probe: string }> = {
  web: {
    label: 'LoanLens web app',
    entry: 'section-a/app/server.ts',
    dataFile: 'section-a/app/public/data/loans.json',
    portVar: 'WEB_PORT',
    port: env.web.port,
    probe: `${env.web.baseUrl}/data/loans.json`,
  },
  api: {
    label: 'LoanLens API',
    entry: 'section-b/api/index.ts',
    dataFile: 'section-b/api/data/loans.json',
    portVar: 'API_PORT',
    port: env.api.port,
    probe: `${env.api.baseUrl}/health`,
  },
};

const children = new Map<AppName, ChildProcess>();
const ready = new Map<AppName, Promise<void>>();

async function isHealthy(name: AppName): Promise<boolean> {
  try {
    const res = await fetch(APPS[name].probe, { signal: AbortSignal.timeout(1_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export function ensureAppServer(name: AppName): Promise<void> {
  let pending = ready.get(name);
  if (pending) return pending;
  const app = APPS[name];
  pending = (async () => {
    if (await isHealthy(name)) return;
    if (!env.autoStart) {
      throw new Error(`${app.label} is not reachable at ${app.probe} and APP_AUTOSTART=false`);
    }
    const child = spawn(process.execPath, ['--import', 'tsx', app.entry], {
      env: { ...process.env, [app.portVar]: String(app.port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.set(name, child);
    let output = '';
    child.stdout?.on('data', (chunk) => (output += chunk));
    child.stderr?.on('data', (chunk) => (output += chunk));
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`${app.label} exited early (code ${child.exitCode}):\n${output}`);
      if (await isHealthy(name)) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`${app.label} did not become healthy within 20s:\n${output}`);
  })();
  ready.set(name, pending);
  return pending;
}

/** The web app serves a build; the API needs none. */
export function assertWebBuilt(): void {
  if (!existsSync(path.resolve('section-a/app/dist/index.html'))) {
    throw new Error('The web app is not built. Run `npm run build` first (`npm run test:section-a` does it for you).');
  }
}

export async function stopAppServers(): Promise<void> {
  for (const child of children.values()) {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((r) => child.once('exit', r));
    }
  }
  children.clear();
  ready.clear();
}
