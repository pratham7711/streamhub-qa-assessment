/**
 * Steps for the SQL scenarios (tests/features/sql). Each scenario's schema and
 * seed are loaded once into an in-process PostgreSQL (PGlite) and shared by the
 * Cucumber scenarios of that feature; every query only reads.
 *
 * Every id or player a step names is first confirmed to exist in the loaded data,
 * so a typo in a feature file, or a boundary case dropped from the seed, fails
 * instead of passing vacuously.
 */
import { AfterAll, type DataTable, Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { PGlite } from '@electric-sql/pglite';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { openScenarioDb, readSql, runQuery, scenarioByName, type QueryResult, type Row, type Scenario } from '../../sql/lib/db.js';
import { expectedRoundTrips, expectedStreaks } from '../../sql/lib/oracle.js';
import { renderScenario, textTable, type RenderedScenario } from '../../sql/scripts/render-results.js';
import type { CustomWorld } from '../support/world.js';

const databases = new Map<Scenario['key'], Promise<PGlite>>();

function database(scenario: Scenario): Promise<PGlite> {
  let db = databases.get(scenario.key);
  if (!db) {
    db = openScenarioDb(scenario);
    databases.set(scenario.key, db);
  }
  return db;
}

AfterAll(async function () {
  for (const db of databases.values()) await (await db).close();
  databases.clear();
});

const scenarioOf = (world: CustomWorld) => world.recall<Scenario>('sqlScenario');
const dbOf = (world: CustomWorld) => world.recall<PGlite>('sqlDb');
const resultOf = (world: CustomWorld) => world.recall<QueryResult>('sqlResult');

function oracle(world: CustomWorld): Promise<Row[]> {
  return scenarioOf(world).key === 'scenario1' ? expectedRoundTrips(dbOf(world)) : expectedStreaks(dbOf(world));
}

async function run(world: CustomWorld, label: string, sql: string): Promise<void> {
  const result = world.remember('sqlResult', await runQuery(dbOf(world), sql));
  world.attach(`${label}\n\n${textTable(result)}`, 'text/plain');
}

async function assertExists(world: CustomWorld, table: string, column: string, values: string[]): Promise<void> {
  const { rows } = await dbOf(world).query<{ v: string }>(`SELECT ${column}::text AS v FROM ${table} WHERE ${column}::text = ANY($1)`, [values]);
  const missing = values.filter((v) => !rows.some((r) => r.v === v));
  expect(missing, `Not in the seeded ${table}.${column}: ${missing.join(', ')}`).toEqual([]);
}

function findPair(world: CustomWorld, sent: string, returned: string): Row | undefined {
  return resultOf(world).rows.find((r) => r.sent_txn_id === sent && r.returned_txn_id === returned);
}

function rowsFor(world: CustomWorld, player: string): Row[] {
  return resultOf(world).rows.filter((r) => r.player_name === player);
}

Given('the {string} SQL scenario is loaded', async function (this: CustomWorld, name: string) {
  const scenario = this.remember('sqlScenario', scenarioByName(name));
  this.remember('sqlDb', await database(scenario));
});

When('I run the scenario query', async function (this: CustomWorld) {
  const { query } = scenarioOf(this);
  await run(this, `sql/${query}`, readSql(query));
});

When('I run the anti-pattern query {string}', async function (this: CustomWorld, name: string) {
  const file = `queries/anti-patterns/${name}.sql`;
  await run(this, `sql/${file} (deliberately wrong)`, readSql(file));
});

Then('the result columns should be {string}', function (this: CustomWorld, columns: string) {
  expect(resultOf(this).columns).toEqual(columns.split(',').map((c) => c.trim()));
});

Then('the result should have {int} row(s)', function (this: CustomWorld, count: number) {
  const result = resultOf(this);
  expect(result.rows.length, textTable(result)).toBe(count);
});

Then('the result should match the independent oracle', async function (this: CustomWorld) {
  const expected = await oracle(this);
  this.attach(`Independent TypeScript oracle\n\n${textTable({ columns: resultOf(this).columns, rows: expected })}`, 'text/plain');
  expect(expected.length, 'The oracle found nothing: the seed no longer exercises this scenario').toBeGreaterThan(0);
  expect(resultOf(this).rows).toEqual(expected);
});

Then('the result should not match the independent oracle', async function (this: CustomWorld) {
  const expected = (await oracle(this)).map((r) => JSON.stringify(r));
  const actual = resultOf(this).rows.map((r) => JSON.stringify(r));
  const extra = actual.filter((r) => !expected.includes(r));
  const missing = expected.filter((r) => !actual.includes(r));
  this.attach(`Rows the oracle does not expect (${extra.length}):\n${extra.join('\n')}\n\nExpected rows missing (${missing.length}):\n${missing.join('\n')}`, 'text/plain');
  expect(extra.length + missing.length, 'This query was expected to disagree with the oracle').toBeGreaterThan(0);
});

Then('sent transfer {string} and return {string} should be reported', async function (this: CustomWorld, sent: string, returned: string) {
  await assertExists(this, 'transactions', 'txn_id', [sent, returned]);
  expect(findPair(this, sent, returned), `${sent} -> ${returned} is missing from:\n${textTable(resultOf(this))}`).toBeDefined();
});

Then('the result should be exactly these round trips, worked out by hand:', async function (this: CustomWorld, table: DataTable) {
  const expected = table.hashes();
  await assertExists(this, 'transactions', 'txn_id', expected.flatMap((r) => [r.sent, r.returned]));
  const key = (r: Record<'sent' | 'returned' | 'hours' | 'pct', string>) => `${r.sent} -> ${r.returned}, ${r.hours} h, ${r.pct}%`;
  const actual = resultOf(this).rows.map((r) => key({ sent: String(r.sent_txn_id), returned: String(r.returned_txn_id), hours: String(r.hours_apart), pct: String(r.pct_difference) }));
  const missing = expected.filter((r) => !actual.includes(key(r))).map((r) => `${key(r)} (${r.why})`);
  const extra = actual.filter((a) => !expected.some((r) => key(r) === a));
  expect({ missing, extra }, textTable(resultOf(this))).toEqual({ missing: [], extra: [] });
});

Then('the seed should hold these near misses, and none of them should be reported:', async function (this: CustomWorld, table: DataTable) {
  const nearMisses = table.hashes();
  await assertExists(this, 'transactions', 'txn_id', nearMisses.flatMap((r) => [r.sent, r.returned]));
  const reported = nearMisses.filter((r) => findPair(this, r.sent, r.returned)).map((r) => `${r.sent} -> ${r.returned} (${r.why})`);
  expect(reported, textTable(resultOf(this))).toEqual([]);
});

Then('{string} should have a streak from {string} to {string} of {int} matches', async function (this: CustomWorld, player: string, start: string, end: string, length: number) {
  await assertExists(this, 'players', 'player_name', [player]);
  expect(rowsFor(this, player), textTable(resultOf(this))).toContainEqual({
    player_name: player,
    streak_start_date: start,
    streak_end_date: end,
    streak_length: length,
  });
});

Then('{string} should appear in exactly {int} row(s)', async function (this: CustomWorld, player: string, count: number) {
  await assertExists(this, 'players', 'player_name', [player]);
  expect(rowsFor(this, player).length, textTable(resultOf(this))).toBe(count);
});

Then('the result should be exactly these streaks, worked out by hand:', async function (this: CustomWorld, table: DataTable) {
  const expected = table.hashes();
  await assertExists(this, 'players', 'player_name', expected.map((r) => r.player));
  const key = (player: string, start: string, end: string, length: string) => `${player}: ${start} to ${end}, ${length} matches`;
  const actual = resultOf(this).rows.map((r) => key(String(r.player_name), String(r.streak_start_date), String(r.streak_end_date), String(r.streak_length)));
  const missing = expected.filter((r) => !actual.includes(key(r.player, r.start, r.end, r.length))).map((r) => `${key(r.player, r.start, r.end, r.length)} (${r.why})`);
  const extra = actual.filter((a) => !expected.some((r) => key(r.player, r.start, r.end, r.length) === a));
  expect({ missing, extra }, textTable(resultOf(this))).toEqual({ missing: [], extra: [] });
});

Then('the seed should hold these players, and none of them should be reported:', async function (this: CustomWorld, table: DataTable) {
  const players = table.hashes();
  await assertExists(this, 'players', 'player_name', players.map((r) => r.player));
  const reported = players.filter((r) => rowsFor(this, r.player).length > 0).map((r) => `${r.player} (${r.why})`);
  expect(reported, textTable(resultOf(this))).toEqual([]);
});

When('I render the query output screenshot', async function (this: CustomWorld) {
  this.remember('sqlRendered', await renderScenario(scenarioOf(this).key));
});

Then('the screenshot should show the oracle match and be attached to this report', function (this: CustomWorld) {
  const rendered = this.recall<RenderedScenario>('sqlRendered');
  expect(rendered.oracleMatches, 'The rendered query output disagrees with the oracle').toBe(true);
  for (const file of [rendered.png, rendered.html, rendered.txt]) expect(statSync(file).size, file).toBeGreaterThan(0);
  this.attach(readFileSync(rendered.png), { mediaType: 'image/png', fileName: path.basename(rendered.png) });
  this.attach(`Evidence written to ${[rendered.png, rendered.html, rendered.txt].map((f) => path.relative(process.cwd(), f)).join(', ')}`, 'text/plain');
});
