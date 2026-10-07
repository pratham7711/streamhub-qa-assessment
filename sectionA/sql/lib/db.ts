/**
 * Loads a scenario's schema and seed into a fresh in-process PostgreSQL
 * (PGlite: real PostgreSQL compiled to WebAssembly, no server or Docker) and
 * runs its query file.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SQL_DIR = fileURLToPath(new URL('..', import.meta.url));

export interface Scenario {
  key: 'scenario1' | 'scenario2';
  title: string;
  schema: string;
  seed: string;
  query: string;
}

export const SCENARIOS: Record<Scenario['key'], Scenario> = {
  scenario1: {
    key: 'scenario1',
    title: 'Scenario 1: round-trip transfers within 24 hours and 10%',
    schema: 'schema/01_transactions.sql',
    seed: 'seed/01_transactions.sql',
    query: 'queries/scenario1_round_trip_transfers.sql',
  },
  scenario2: {
    key: 'scenario2',
    title: 'Scenario 2: IPL 2024 players with 30+ runs in 3+ consecutive matches',
    schema: 'schema/02_ipl.sql',
    seed: 'seed/02_ipl.sql',
    query: 'queries/scenario2_ipl_30plus_streaks.sql',
  },
};

export type Row = Record<string, string | number | null>;

export interface QueryResult {
  columns: string[];
  rows: Row[];
}

export const readSql = (relative: string) => readFileSync(path.join(SQL_DIR, relative), 'utf8');

export function scenarioByName(name: string): Scenario {
  const found = Object.values(SCENARIOS).find(
    (s) => s.key === name || path.basename(s.query) === name || s.title.toLowerCase().includes(name.toLowerCase()),
  );
  if (!found) throw new Error(`Unknown SQL scenario "${name}"`);
  return found;
}

export async function openScenarioDb(scenario: Scenario): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readSql(scenario.schema));
  await db.exec(readSql(scenario.seed));
  return db;
}

/** Values come back as text/number only: NUMERIC stays an exact string, dates are formatted in SQL. */
export async function runQuery(db: PGlite, sql: string): Promise<QueryResult> {
  const result = await db.query<Record<string, unknown>>(sql);
  return {
    columns: result.fields.map((f) => f.name),
    rows: result.rows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : (v as string | number | null)])),
    ),
  };
}

export async function engineVersion(db: PGlite): Promise<string> {
  const { rows } = await db.query<{ v: string }>('SELECT version() AS v');
  return rows[0].v.replace(/ on wasm32.*$/, '');
}
