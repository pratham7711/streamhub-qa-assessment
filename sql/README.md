# SQL scenarios

Two SQL queries in the PostgreSQL dialect. Each comes with its table schema, seed data, a
screenshot of the query output, and a Cucumber suite. The suite checks every row against an
independent oracle and every edge case by name.

| | Scenario 1: round-trip transfers | Scenario 2: IPL 2024 30+ streaks |
|---|---|---|
| Query | [`queries/scenario1_round_trip_transfers.sql`](queries/scenario1_round_trip_transfers.sql) | [`queries/scenario2_ipl_30plus_streaks.sql`](queries/scenario2_ipl_30plus_streaks.sql) |
| Schema | [`schema/01_transactions.sql`](schema/01_transactions.sql) | [`schema/02_ipl.sql`](schema/02_ipl.sql) |
| Seed data | [`seed/01_transactions.sql`](seed/01_transactions.sql) (28 accounts, 35 transfers) | [`seed/02_ipl.sql`](seed/02_ipl.sql) (12 players, 50 matches, 102 innings) |
| Output screenshot | [`results/scenario1.png`](results/scenario1.png) | [`results/scenario2.png`](results/scenario2.png) |
| Output as text | [`results/scenario1.txt`](results/scenario1.txt) (10 rows) | [`results/scenario2.txt`](results/scenario2.txt) (7 rows) |
| Tests | [`sql/features/round-trip-transfers.feature`](../sql/features/round-trip-transfers.feature) | [`sql/features/ipl-streaks.feature`](../sql/features/ipl-streaks.feature) |

## How to run

```bash
npm run test:sql                          # 6 Cucumber scenarios; npm run test:section-a/-b writes them to section-<a|b>/reports/sql/
npx tsx sql/scripts/render-results.ts     # re-renders results/*.png|html|txt (the suite does this too)
npx tsx sql/scripts/build-ipl-seed.ts     # regenerates seed/02_ipl.sql from data/ipl-fixtures.ts
```

You do not need a database server. The queries run on **PostgreSQL 18.3**, compiled to
WebAssembly ([PGlite](https://pglite.dev)) and loaded in-process. Each run builds a fresh
database from the schema and seed files.

To run a query in any other PostgreSQL 12+ instance, or in an online compiler such as
[DB Fiddle](https://www.db-fiddle.com) (choose PostgreSQL), paste three files in order:
the schema, then the seed, then the query.

## How the results are verified

- **Independent oracle** ([`lib/oracle.ts`](lib/oracle.ts)). It reads the raw tables with plain
  `SELECT`s (no joins, windows or filters) and recomputes each answer in TypeScript. Money is
  handled in integer paise and time in integer seconds, so the 10% and 24-hour boundaries are
  decided exactly. The query output must equal the oracle row for row, column for column and in
  the same order.
- **Named edge cases.** Each seeded case has its own Scenario Outline row, with a "why" column.
  A "not reported" check first confirms the ids exist in the seed, so a typo fails the test
  instead of passing silently.
- **The tests can fail.** [`queries/anti-patterns/`](queries/anti-patterns) holds two plausible
  but wrong queries, and the suite asserts that the oracle check rejects both:
  - An `ABS()` time difference without a self-transfer filter returns 23 rows instead of 10.
  - A `LAG`/`LEAD` window query returns 11 rows instead of 7: Kohli appears 3 times, and Gill's
    2023→2024 run leaks in.

## Scenario 1: round-trip transfers

Account A sends money to B, then B sends a similar amount (within 10%) back to A within 24 hours.
The query is a self-join of `transactions`: `s` is the original transfer and `r` is the return.

```sql
ON  r.from_account = s.to_account                     -- B sends ...
AND r.to_account   = s.from_account                   -- ... back to A
AND r.txn_time     >  s.txn_time                      -- strictly after the original
AND r.txn_time     <= s.txn_time + INTERVAL '24 hours'
AND ABS(r.amount - s.amount) <= 0.10 * s.amount       -- within 10% of the original
```

**Assumptions**
- Both boundaries are inclusive: a return exactly 24h later, or exactly 10% higher or lower,
  is reported.
- 10% is measured against the **original (sent)** amount. To measure against the larger of
  the two amounts, use `0.10 * GREATEST(s.amount, r.amount)`.
- "Back" means strictly later. The earlier transfer is always A → B, so each round trip is
  reported once and never again with A and B swapped.
- Self-transfers (from = to) are not round trips.
- Every qualifying pair is reported, so one transfer with two qualifying returns gives two rows.
  To keep only the first return, add `DISTINCT ON (s.txn_id)`.
- Money is `NUMERIC(12,2)`. With `FLOAT`, the exact 10% boundary could be misjudged.

**Edge cases in the seed** (one pair of accounts per case, so cases cannot interfere)

| Case | Transfers | Expected |
|---|---|---|
| Same amount back 2.5h later | TX0101 → TX0102 | reported |
| Back exactly 24h later | TX0201 → TX0202 | reported |
| Back 24h **and 1 second** later | TX0301 → TX0302 | not reported |
| Exactly 10% less / 10% more | TX0401 → TX0402, TX0501 → TX0502 | reported |
| 10% less or more **plus one paisa** | TX0601 → TX0602 / TX0603 | not reported |
| A's account id sorts after B's | TX0701 → TX0702 | reported once, with A = AC207 |
| Self-transfers | TX0801, TX0802 | not reported |
| Triangle A → B → C → A | TX0901–TX0903 | not reported |
| Two qualifying returns | TX1001 → TX1002 and → TX1003 | two rows |
| Chain A → B → A → B | TX1101 → TX1102 → TX1103 | two rows |
| Only 5% comes back | TX1201 → TX1202 | not reported |
| Odd paise either side of 10% (333.33) | TX1301 → TX1302 (366.66) / TX1303 (366.67) | reported / not reported |
| Unrelated transfers (noise) | TX9001–TX9004 | not reported |

**Output: 10 rows**

```
 account_a | account_b | sent_txn_id | sent_amount | sent_at             | returned_txn_id | returned_amount | returned_at         | hours_apart | pct_difference
-----------+-----------+-------------+-------------+---------------------+-----------------+-----------------+---------------------+-------------+----------------
 AC101     | AC201     | TX0101      | 25000.00    | 2024-03-01 09:00:00 | TX0102          | 25000.00        | 2024-03-01 11:30:00 | 2.50        | 0.000
 AC102     | AC202     | TX0201      | 10000.00    | 2024-03-02 10:00:00 | TX0202          | 9800.00         | 2024-03-03 10:00:00 | 24.00       | 2.000
 AC104     | AC204     | TX0401      | 20000.00    | 2024-03-06 09:00:00 | TX0402          | 18000.00        | 2024-03-06 15:00:00 | 6.00        | 10.000
 AC105     | AC205     | TX0501      | 20000.00    | 2024-03-07 09:00:00 | TX0502          | 22000.00        | 2024-03-07 21:00:00 | 12.00       | 10.000
 AC207     | AC107     | TX0701      | 15000.00    | 2024-03-09 08:00:00 | TX0702          | 15000.00        | 2024-03-09 10:00:00 | 2.00        | 0.000
 AC110     | AC210     | TX1001      | 50000.00    | 2024-03-12 09:00:00 | TX1002          | 49000.00        | 2024-03-12 11:00:00 | 2.00        | 2.000
 AC110     | AC210     | TX1001      | 50000.00    | 2024-03-12 09:00:00 | TX1003          | 52500.00        | 2024-03-12 18:00:00 | 9.00        | 5.000
 AC111     | AC211     | TX1101      | 40000.00    | 2024-03-13 09:00:00 | TX1102          | 40000.00        | 2024-03-13 13:00:00 | 4.00        | 0.000
 AC211     | AC111     | TX1102      | 40000.00    | 2024-03-13 13:00:00 | TX1103          | 39000.00        | 2024-03-13 20:00:00 | 7.00        | 2.500
 AC113     | AC213     | TX1301      | 333.33      | 2024-03-15 09:00:00 | TX1302          | 366.66          | 2024-03-15 09:45:00 | 0.75        | 9.999
```

## Scenario 2: IPL 2024 players with 30+ runs in 3+ consecutive matches

This is a "gaps and islands" problem, solved with two `ROW_NUMBER()`s:

1. Number each player's 2024 innings in date order (`innings_no`).
2. Keep only the 30+ innings and number them again.
3. Inside an unbroken run, both numbers rise together, so their difference is constant. That
   difference is the streak id.
4. Group by player and streak id, and keep groups with `COUNT(*) >= 3`.

The query returns the player, the streak start date, and also the end date and length.

**Assumptions**
- 30+ means `runs >= 30`.
- "Consecutive matches" means consecutive innings the player batted in during 2024. A fixture
  the player sat out, or did not bat in, has no `batting_innings` row and does not break the
  streak. To make a missed team fixture break it, number the team's fixtures instead and
  `LEFT JOIN` the innings, treating a missing row as below 30.
- The season filter is applied **before** numbering, so a run that started in 2023 cannot
  carry into 2024.
- Matches are ordered by `match_date`, with `match_id` as the tie-break, never by insertion
  order.
- A player with two separate streaks gets two rows. A 5-match streak is **one** row (length 5),
  not three overlapping 3-match windows.

**Data.** The data is synthetic: real player and team names, invented scores and dates. Every
player exists to prove one rule. The commented fixtures are in
[`data/ipl-fixtures.ts`](data/ipl-fixtures.ts), and the generator writes the same comments into
the seed file.

| Player | Proves | Expected |
|---|---|---|
| Virat Kohli | a 5-match streak is one row | 1 row, length 5 |
| Ruturaj Gaikwad | a streak of exactly 3 that ends on exactly 30 | 1 row |
| Phil Salt | 30, 30, 30 (30 counts) | 1 row |
| Travis Head | two streaks in one season | 2 rows |
| KL Rahul | a match not batted in is skipped | 1 row |
| Rishabh Pant | rows inserted newest-first | 1 row |
| Abhishek Sharma | a 29 breaks a would-be 5-match run | none |
| Sanju Samson | four 30+ scores, never consecutive | none |
| Shubman Gill | 36, 52 (end of 2023) then 41, 33 (start of 2024) | none |
| Rohit Sharma, Jasprit Bumrah, Shashank Singh | noise | none |

**Output: 7 rows**

```
 player_name     | streak_start_date | streak_end_date | streak_length
-----------------+-------------------+-----------------+---------------
 Travis Head     | 2024-03-22        | 2024-04-05      | 3
 Phil Salt       | 2024-03-23        | 2024-04-04      | 3
 Virat Kohli     | 2024-03-23        | 2024-04-19      | 5
 KL Rahul        | 2024-03-25        | 2024-04-09      | 3
 Ruturaj Gaikwad | 2024-03-28        | 2024-04-09      | 3
 Rishabh Pant    | 2024-04-01        | 2024-04-12      | 3
 Travis Head     | 2024-04-19        | 2024-05-05      | 4
```

## Porting to MySQL 8 or SQLite

Both queries use only standard constructs (CTEs, `ROW_NUMBER()`, a self-join) apart from these.
This mapping has not been executed on MySQL or SQLite; only the PostgreSQL versions are tested.

| PostgreSQL | MySQL 8 | SQLite 3.25+ |
|---|---|---|
| `s.txn_time + INTERVAL '24 hours'` | `s.txn_time + INTERVAL 24 HOUR` | `datetime(s.txn_time, '+24 hours')` |
| `EXTRACT(EPOCH FROM (r.txn_time - s.txn_time)) / 3600` | `TIMESTAMPDIFF(SECOND, s.txn_time, r.txn_time) / 3600` | `(julianday(r.txn_time) - julianday(s.txn_time)) * 24` |
| `TO_CHAR(x, 'YYYY-MM-DD HH24:MI:SS')` | `DATE_FORMAT(x, '%Y-%m-%d %H:%i:%s')` | `strftime('%Y-%m-%d %H:%M:%S', x)` |
| `COUNT(*)::INT` | `COUNT(*)` | `COUNT(*)` |

`TO_CHAR` is only there to give stable display formatting; dropping it does not change which
rows are returned. SQLite has no exact `NUMERIC` type, so store money as integer paise there.
