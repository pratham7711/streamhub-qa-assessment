-- Scenario 2: players who scored 30+ runs in at least 3 consecutive matches
-- in the 2024 season, with the date each streak started.
--
-- Technique: "gaps and islands" with two ROW_NUMBER()s.
--   1. Number each player's 2024 innings in date order (innings_no).
--   2. Keep only the 30+ innings and number them again with a second ROW_NUMBER().
--   3. Inside an unbroken run of 30+ innings both numbers rise together, so
--      their difference is constant: that difference is the streak id.
--   4. Group by (player, streak id) and keep groups of 3 or more.
-- A 5-match streak therefore comes out as ONE row (length 5), not as three
-- overlapping 3-match windows, which is what a LAG/LEAD-based query returns.
--
-- Assumptions (see sql/README.md):
--   * 30+ means runs >= 30.
--   * "Consecutive matches" = consecutive matches in which the player batted
--     in 2024. A fixture the player sat out or did not bat in is skipped, not a break.
--     To make a missed team fixture break the streak, number the team's
--     fixtures instead and LEFT JOIN the innings (treat a missing row as < 30).
--   * The season filter is applied BEFORE numbering, so runs that started in
--     2023 cannot carry into 2024.
WITH innings_2024 AS (
  SELECT
    b.player_id,
    m.match_date,
    b.runs,
    ROW_NUMBER() OVER (PARTITION BY b.player_id
                       ORDER BY m.match_date, m.match_id) AS innings_no
  FROM batting_innings AS b
  JOIN matches         AS m ON m.match_id = b.match_id
  WHERE m.season = 2024
),
scores_30_plus AS (
  SELECT
    player_id,
    match_date,
    innings_no - ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY innings_no) AS streak_id
  FROM innings_2024
  WHERE runs >= 30
),
streaks AS (
  SELECT
    player_id,
    MIN(match_date)  AS streak_start_date,
    MAX(match_date)  AS streak_end_date,
    COUNT(*)::INT    AS streak_length
  FROM scores_30_plus
  GROUP BY player_id, streak_id
  HAVING COUNT(*) >= 3
)
SELECT
  p.player_name,
  TO_CHAR(s.streak_start_date, 'YYYY-MM-DD') AS streak_start_date,
  TO_CHAR(s.streak_end_date,   'YYYY-MM-DD') AS streak_end_date,
  s.streak_length
FROM streaks AS s
JOIN players AS p ON p.player_id = s.player_id
ORDER BY s.streak_start_date, p.player_name;
