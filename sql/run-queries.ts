/**
 * Runs both A4 queries on PostgreSQL (PGlite, in-process) and writes their output to
 * sql/results/<scenario>.txt and a screenshot of the output, query and schema to <scenario>.png.
 * Run: npm run sql
 */
import { PGlite } from '@electric-sql/pglite';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SQL_DIR = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(path.join(SQL_DIR, relative), 'utf8');

const SCENARIOS = [
  {
    key: 'scenario1',
    title: 'Scenario 1: round-trip transfers within 24 hours and 10%',
    schema: 'schema/01_transactions.sql',
    seed: 'seed/01_transactions.sql',
    query: 'queries/scenario1_round_trip_transfers.sql',
  },
  {
    key: 'scenario2',
    title: 'Scenario 2: IPL 2024 players with 30+ runs in 3+ consecutive matches',
    schema: 'schema/02_ipl.sql',
    seed: 'seed/02_ipl.sql',
    query: 'queries/scenario2_ipl_30plus_streaks.sql',
  },
];

type Row = Record<string, unknown>;
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** psql-style aligned text table. */
function textTable(columns: string[], rows: Row[]): string {
  const cells = rows.map((r) => columns.map((c) => String(r[c] ?? 'NULL')));
  const widths = columns.map((c, i) => Math.max(c.length, ...cells.map((row) => row[i].length)));
  const line = (values: string[]) => ` ${values.map((v, i) => v.padEnd(widths[i])).join(' | ')}`;
  const rule = `-${widths.map((w) => '-'.repeat(w)).join('-+-')}-`;
  return [line(columns), rule, ...cells.map(line), `(${rows.length} row${rows.length === 1 ? '' : 's'})`].join('\n');
}

function html(title: string, engine: string, columns: string[], rows: Row[], query: string, schema: string): string {
  const head = columns.map((c) => `<th>${escape(c)}</th>`).join('');
  const body = rows.map((r) => `<tr>${columns.map((c) => `<td>${escape(String(r[c] ?? 'NULL'))}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 28px 36px; background: #f6f7f9; color: #1b2430; font: 15px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; }
  h1 { font-size: 21px; margin: 0 0 4px; } h2 { font-size: 13px; text-transform: uppercase; color: #5b6675; margin: 22px 0 8px; }
  .meta { color: #5b6675; font-size: 13px; }
  pre, table { background: #fff; border: 1px solid #d9dee5; border-radius: 8px; font: 12.5px/1.5 ui-monospace, Menlo, Consolas, monospace; }
  pre { margin: 0; padding: 12px 14px; white-space: pre-wrap; }
  table { border-collapse: collapse; } th, td { padding: 6px 12px; border-bottom: 1px solid #d9dee5; text-align: left; white-space: nowrap; }
  th { background: #eef1f5; } .grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 18px; }
</style>
<h1>${escape(title)}</h1><div class="meta">${escape(engine)} · ${rows.length} rows</div>
<h2>Query output</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<div class="grid"><div><h2>Query</h2><pre>${escape(query)}</pre></div><div><h2>Table schema</h2><pre>${escape(schema)}</pre></div></div>`;
}

const outDir = path.join(SQL_DIR, 'results');
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const s of SCENARIOS) {
    const db = new PGlite();
    await db.exec(read(s.schema));
    await db.exec(read(s.seed));
    const result = await db.query<Row>(read(s.query));
    const engine = (await db.query<{ v: string }>('SELECT version() AS v')).rows[0].v.replace(/ on wasm32.*$/, '');
    await db.close();

    const columns = result.fields.map((f) => f.name);
    writeFileSync(path.join(outDir, `${s.key}.txt`), `${s.title}\n\n${textTable(columns, result.rows)}\n`);
    const tab = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1.5 });
    await tab.setContent(html(s.title, engine, columns, result.rows, read(s.query), read(s.schema)));
    await tab.screenshot({ path: path.join(outDir, `${s.key}.png`), fullPage: true });
    await tab.close();
    console.log(`${s.key}: ${result.rows.length} rows -> sql/results/${s.key}.png, ${s.key}.txt`);
  }
} finally {
  await browser.close();
}
