/**
 * Independent oracle for the SQL scenarios. It reads the raw tables back out of
 * the loaded database (plain SELECT *, no joins, filters or windows) and
 * recomputes each scenario's answer in TypeScript, so the SQL query is checked
 * against a second implementation of the same rules rather than against itself.
 *
 * Money is handled as integer paise and time as integer seconds, so the 10%
 * and 24-hour boundaries are decided exactly.
 */
import type { PGlite } from '@electric-sql/pglite';
import type { Row } from './db.js';

const toPaise = (amount: string) => {
  const [rupees, paise = ''] = amount.split('.');
  return Number(rupees) * 100 + Number(paise.padEnd(2, '0').slice(0, 2));
};
const toSeconds = (timestamp: string) => Date.parse(`${timestamp.replace(' ', 'T')}Z`) / 1000;

/** Round numerator/denominator half away from zero to `places` decimals, as PostgreSQL ROUND(numeric) does. */
function roundRatio(numerator: number, denominator: number, places: number): string {
  const scale = 10 ** places;
  const scaled = Math.floor((2 * numerator * scale + denominator) / (2 * denominator));
  const whole = Math.floor(scaled / scale);
  const frac = String(scaled % scale).padStart(places, '0');
  return `${whole}.${frac}`;
}

interface Txn { txn_id: string; from_account: string; to_account: string; amount: string; txn_time: string }

export async function expectedRoundTrips(db: PGlite): Promise<Row[]> {
  const { rows } = await db.query<Txn>(
    `SELECT txn_id, from_account, to_account, amount::text AS amount, TO_CHAR(txn_time, 'YYYY-MM-DD HH24:MI:SS') AS txn_time FROM transactions`,
  );
  const transfers = rows.filter((t) => t.from_account !== t.to_account);
  const pairs: Row[] = [];
  for (const sent of transfers) {
    for (const back of transfers) {
      const gap = toSeconds(back.txn_time) - toSeconds(sent.txn_time);
      const sentPaise = toPaise(sent.amount);
      const diffPaise = Math.abs(toPaise(back.amount) - sentPaise);
      const isReturn = back.from_account === sent.to_account && back.to_account === sent.from_account;
      if (isReturn && gap > 0 && gap <= 24 * 3600 && diffPaise * 10 <= sentPaise) {
        pairs.push({
          account_a: sent.from_account,
          account_b: sent.to_account,
          sent_txn_id: sent.txn_id,
          sent_amount: sent.amount,
          sent_at: sent.txn_time,
          returned_txn_id: back.txn_id,
          returned_amount: back.amount,
          returned_at: back.txn_time,
          hours_apart: roundRatio(gap, 3600, 2),
          pct_difference: roundRatio(diffPaise * 100, sentPaise, 3),
        });
      }
    }
  }
  const key = (r: Row) => `${r.sent_at}|${r.sent_txn_id}|${r.returned_at}|${r.returned_txn_id}`;
  return pairs.sort((a, b) => key(a).localeCompare(key(b)));
}

export async function expectedStreaks(db: PGlite, season = 2024, minRuns = 30, minLength = 3): Promise<Row[]> {
  const players = (await db.query<{ player_id: number; player_name: string }>('SELECT player_id, player_name FROM players')).rows;
  const matches = (await db.query<{ match_id: number; season: number; match_date: string }>(
    `SELECT match_id, season, TO_CHAR(match_date, 'YYYY-MM-DD') AS match_date FROM matches`,
  )).rows;
  const innings = (await db.query<{ match_id: number; player_id: number; runs: number }>('SELECT match_id, player_id, runs FROM batting_innings')).rows;

  const matchById = new Map(matches.map((m) => [m.match_id, m]));
  const result: Row[] = [];
  for (const player of players) {
    const mine = innings
      .map((i) => ({ ...i, match: matchById.get(i.match_id)! }))
      .filter((i) => i.player_id === player.player_id && i.match.season === season)
      .sort((a, b) => a.match.match_date.localeCompare(b.match.match_date) || a.match_id - b.match_id);

    let run: typeof mine = [];
    const close = () => {
      if (run.length >= minLength) {
        result.push({
          player_name: player.player_name,
          streak_start_date: run[0].match.match_date,
          streak_end_date: run.at(-1)!.match.match_date,
          streak_length: run.length,
        });
      }
      run = [];
    };
    for (const inning of mine) {
      if (inning.runs >= minRuns) run.push(inning);
      else close();
    }
    close();
  }
  return result.sort(
    (a, b) => String(a.streak_start_date).localeCompare(String(b.streak_start_date)) || String(a.player_name).localeCompare(String(b.player_name)),
  );
}
