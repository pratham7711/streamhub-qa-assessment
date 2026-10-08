# A4: SQL

Both queries are in the PostgreSQL dialect. `npm run sql` loads each schema and seed into PostgreSQL 18 (PGlite, in-process, nothing to install), runs the query, and writes the output as text and as a screenshot.

| | Scenario 1: round-trip transfers | Scenario 2: IPL 2024 30+ streaks |
|---|---|---|
| Query | [`scenario1_round_trip_transfers.sql`](queries/scenario1_round_trip_transfers.sql) | [`scenario2_ipl_30plus_streaks.sql`](queries/scenario2_ipl_30plus_streaks.sql) |
| Table schema | [`01_transactions.sql`](schema/01_transactions.sql) | [`02_ipl.sql`](schema/02_ipl.sql) |
| Seed data | [`01_transactions.sql`](seed/01_transactions.sql): 28 accounts, 35 transfers | [`02_ipl.sql`](seed/02_ipl.sql): 12 players, 50 matches, 102 innings |
| Output | [screenshot](results/scenario1.png) · [text](results/scenario1.txt), 10 rows | [screenshot](results/scenario2.png) · [text](results/scenario2.txt), 7 rows |

## Scenario 1: round-trip transfers

A self-join of `transactions`: `s` is the transfer from A to B, `r` is the return from B to A, strictly later and at most 24 hours after it, with `ABS(r.amount - s.amount) <= 0.10 * s.amount`.

Assumptions:
- Both limits are inclusive: a return exactly 24 hours later, or exactly 10% off, counts.
- 10% is measured against the amount originally sent. `0.10 * GREATEST(s.amount, r.amount)` would make it symmetric.
- Every qualifying pair is reported, so a transfer with two qualifying returns gives two rows.
- Money is `NUMERIC(12,2)`, so the exact 10% boundary is not blurred by floating point.

The seed holds the edge cases next to ordinary transfers: exactly 24 hours, 24 hours and one second, exactly 10%, 10% plus one paisa, a self-transfer, a triangle A → B → C → A, and two returns for one transfer.

## Scenario 2: IPL 2024 players with 30+ runs in 3+ consecutive matches

A "gaps and islands" query. Number each player's 2024 innings by date, keep the 30+ ones and number them again. Inside an unbroken run both numbers rise together, so their difference identifies the streak. Group by player and streak, and keep groups of 3 or more. The output gives the player, the date the streak started, and also its end date and length.

Assumptions:
- 30+ means `runs >= 30`.
- "Consecutive matches" means consecutive matches the player batted in during 2024. A match the player missed does not break the streak. To make it break, number the team's fixtures instead and `LEFT JOIN` the innings.
- The season is filtered before numbering, so a run from the end of 2023 cannot carry into 2024.
- A 5-match streak is one row of length 5, not three overlapping 3-match windows. A player with two streaks gets two rows.

The data is synthetic: real player names, invented scores and dates.
