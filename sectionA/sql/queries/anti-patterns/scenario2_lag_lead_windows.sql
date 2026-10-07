-- ANTI-PATTERN, kept on purpose to prove the tests can fail.
-- The common LAG/LEAD shortcut: "this innings and the ones either side are 30+".
-- It reports every 3-match WINDOW, so a 5-match streak appears three times, and
-- because it does not filter the season first, a run from 2023 leaks into 2024.
-- tests/features/sql runs it and expects the oracle comparison to FAIL.
WITH innings AS (
  SELECT
    b.player_id,
    m.match_date,
    b.runs,
    LAG(b.runs)        OVER w AS previous_runs,
    LEAD(b.runs)       OVER w AS next_runs,
    LAG(m.match_date)  OVER w AS previous_date,
    LEAD(m.match_date) OVER w AS next_date
  FROM batting_innings AS b
  JOIN matches         AS m ON m.match_id = b.match_id
  WINDOW w AS (PARTITION BY b.player_id ORDER BY m.match_date)
)
SELECT
  p.player_name,
  TO_CHAR(i.previous_date, 'YYYY-MM-DD') AS streak_start_date,
  TO_CHAR(i.next_date,     'YYYY-MM-DD') AS streak_end_date,
  3                                      AS streak_length
FROM innings AS i
JOIN players AS p ON p.player_id = i.player_id
WHERE i.previous_runs >= 30 AND i.runs >= 30 AND i.next_runs >= 30
  AND EXTRACT(YEAR FROM i.match_date) = 2024
ORDER BY streak_start_date, p.player_name;
