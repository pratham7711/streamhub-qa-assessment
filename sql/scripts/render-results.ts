/**
 * Renders each SQL scenario's evidence: the table schema, the query, the output
 * table and the oracle check, as sql/results/<scenario>.{html,png,txt}.
 * Run: npx tsx sql/scripts/render-results.ts
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCENARIOS, SQL_DIR, engineVersion, openScenarioDb, readSql, runQuery, type QueryResult, type Scenario } from '../lib/db.js';
import { expectedRoundTrips, expectedStreaks } from '../lib/oracle.js';

export const RESULTS_DIR = path.join(SQL_DIR, 'results');

export interface RenderedScenario {
  result: QueryResult;
  oracleMatches: boolean;
  png: string;
  html: string;
  txt: string;
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const KEYWORDS = /\b(WITH|AS|SELECT|FROM|JOIN|ON|AND|WHERE|GROUP BY|HAVING|ORDER BY|PARTITION BY|OVER|ROW_NUMBER|COUNT|MIN|MAX|ROUND|ABS|EXTRACT|EPOCH|INTERVAL|TO_CHAR|CREATE TABLE|CREATE INDEX|PRIMARY KEY|REFERENCES|NOT NULL|CHECK|INT|VARCHAR|NUMERIC|TIMESTAMP|DATE)\b/g;

function highlight(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      const at = line.indexOf('--');
      const code = at === -1 ? line : line.slice(0, at);
      const comment = at === -1 ? '' : line.slice(at);
      return escape(code).replace(KEYWORDS, '<b>$1</b>') + (comment ? `<i>${escape(comment)}</i>` : '');
    })
    .join('\n');
}

/** psql-style aligned text table. */
export function textTable({ columns, rows }: QueryResult): string {
  const cells = rows.map((r) => columns.map((c) => String(r[c] ?? 'NULL')));
  const widths = columns.map((c, i) => Math.max(c.length, ...cells.map((row) => row[i].length)));
  const line = (values: string[]) => ` ${values.map((v, i) => v.padEnd(widths[i])).join(' | ')}`;
  return [line(columns), `-${widths.map((w) => '-'.repeat(w)).join('-+-')}-`, ...cells.map(line), `(${rows.length} row${rows.length === 1 ? '' : 's'})`].join('\n');
}

function page(scenario: Scenario, result: QueryResult, meta: { engine: string; oracleMatches: boolean; counts: string; generatedAt: string }): string {
  const head = result.columns.map((c) => `<th>${escape(c)}</th>`).join('');
  const body = result.rows
    .map((r) => `<tr>${result.columns.map((c) => `<td>${escape(String(r[c] ?? 'NULL'))}</td>`).join('')}</tr>`)
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escape(scenario.title)}</title>
<style>
  :root { --ink:#1b2430; --muted:#5b6675; --rule:#d9dee5; --bg:#f6f7f9; --ok:#1f7a4d; --bad:#b3261e; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 40px 40px; background: var(--bg); color: var(--ink); font: 15px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .meta { color: var(--muted); font-size: 13px; margin-bottom: 18px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-weight: 600; font-size: 13px; color: #fff; background: var(--ok); }
  .badge.bad { background: var(--bad); }
  h2 { font-size: 13px; letter-spacing: .02em; text-transform: uppercase; color: var(--muted); margin: 26px 0 8px; }
  pre { margin: 0; background: #fff; border: 1px solid var(--rule); border-radius: 8px; padding: 14px 16px; font: 12.5px/1.55 ui-monospace, "SF Mono", Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
  pre b { color: #1d4ed8; font-weight: 600; } pre i { color: #6b7280; }
  table { border-collapse: collapse; background: #fff; border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; font: 13px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
  th, td { padding: 7px 12px; border-bottom: 1px solid var(--rule); text-align: left; white-space: nowrap; }
  th { background: #eef1f5; font-weight: 700; }
  tr:last-child td { border-bottom: 0; }
  .grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 18px; }
</style></head>
<body>
  <h1>${escape(scenario.title)}</h1>
  <div class="meta">Engine: ${escape(meta.engine)} &middot; Data: ${escape(meta.counts)} &middot; Generated ${escape(meta.generatedAt)} &middot; Query: sql/${escape(scenario.query)}</div>
  <span class="badge${meta.oracleMatches ? '' : ' bad'}">${result.rows.length} rows &middot; ${meta.oracleMatches ? 'matches the independent TypeScript oracle' : 'DOES NOT match the oracle'}</span>
  <h2>Query output</h2>
  <table><thead><tr>${head}</tr></thead><tbody>
${body}
  </tbody></table>
  <div class="grid">
    <div><h2>Query</h2><pre>${highlight(readSql(scenario.query))}</pre></div>
    <div><h2>Table schema</h2><pre>${highlight(readSql(scenario.schema))}</pre></div>
  </div>
</body></html>`;
}

async function tableCounts(db: Awaited<ReturnType<typeof openScenarioDb>>): Promise<string> {
  const { rows } = await db.query<{ t: string }>(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
  );
  const parts: string[] = [];
  for (const { t } of rows) {
    const { rows: c } = await db.query<{ n: number }>(`SELECT COUNT(*)::INT AS n FROM ${t}`);
    parts.push(`${t} ${c[0].n}`);
  }
  return parts.join(', ');
}

export async function renderScenario(key: Scenario['key']): Promise<RenderedScenario> {
  const scenario = SCENARIOS[key];
  const db = await openScenarioDb(scenario);
  try {
    const result = await runQuery(db, readSql(scenario.query));
    const expected = key === 'scenario1' ? await expectedRoundTrips(db) : await expectedStreaks(db);
    const oracleMatches = JSON.stringify(result.rows) === JSON.stringify(expected);
    const html = page(scenario, result, {
      engine: await engineVersion(db),
      oracleMatches,
      counts: await tableCounts(db),
      generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    });

    mkdirSync(RESULTS_DIR, { recursive: true });
    const files = { html: path.join(RESULTS_DIR, `${key}.html`), png: path.join(RESULTS_DIR, `${key}.png`), txt: path.join(RESULTS_DIR, `${key}.txt`) };
    writeFileSync(files.html, html);
    writeFileSync(files.txt, `${scenario.title}\n\n${textTable(result)}\n`);

    const browser = await chromium.launch();
    try {
      const tab = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1.5 });
      await tab.setContent(html, { waitUntil: 'load' });
      await tab.screenshot({ path: files.png, fullPage: true });
    } finally {
      await browser.close();
    }
    return { result, oracleMatches, ...files };
  } finally {
    await db.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  for (const key of Object.keys(SCENARIOS) as Scenario['key'][]) {
    const out = await renderScenario(key);
    console.log(`${key}: ${out.result.rows.length} rows, oracle ${out.oracleMatches ? 'MATCH' : 'MISMATCH'} -> ${path.relative(process.cwd(), out.png)}`);
    if (!out.oracleMatches) process.exitCode = 1;
  }
}
