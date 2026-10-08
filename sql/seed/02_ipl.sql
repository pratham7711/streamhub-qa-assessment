-- Scenario 2 seed data: SYNTHETIC IPL-style batting scores.
-- Real player and team names for readability; every score and date is invented.

INSERT INTO players (player_id, player_name, team) VALUES
  (1, 'Virat Kohli', 'RCB'),
  (2, 'Ruturaj Gaikwad', 'CSK'),
  (3, 'Travis Head', 'SRH'),
  (4, 'Abhishek Sharma', 'SRH'),
  (5, 'Phil Salt', 'KKR'),
  (6, 'Sanju Samson', 'RR'),
  (7, 'KL Rahul', 'LSG'),
  (8, 'Shubman Gill', 'GT'),
  (9, 'Rohit Sharma', 'MI'),
  (10, 'Jasprit Bumrah', 'MI'),
  (11, 'Rishabh Pant', 'DC'),
  (12, 'Shashank Singh', 'PBKS');

-- 2024 fixtures are inserted before the 2023 ones on purpose: physical row order
-- must never matter, only match_date does.
INSERT INTO matches (match_id, season, match_date, home_team, away_team, venue) VALUES
  (2401, 2024, '2024-03-22', 'CSK', 'SRH', 'MA Chidambaram Stadium, Chennai'),
  (2402, 2024, '2024-03-23', 'RCB', 'KKR', 'M. Chinnaswamy Stadium, Bengaluru'),
  (2403, 2024, '2024-03-24', 'RR', 'PBKS', 'Sawai Mansingh Stadium, Jaipur'),
  (2404, 2024, '2024-03-25', 'DC', 'LSG', 'Arun Jaitley Stadium, Delhi'),
  (2405, 2024, '2024-03-26', 'GT', 'MI', 'Narendra Modi Stadium, Ahmedabad'),
  (2406, 2024, '2024-03-28', 'KKR', 'CSK', 'Eden Gardens, Kolkata'),
  (2407, 2024, '2024-03-29', 'RR', 'SRH', 'Sawai Mansingh Stadium, Jaipur'),
  (2408, 2024, '2024-03-30', 'RCB', 'LSG', 'M. Chinnaswamy Stadium, Bengaluru'),
  (2409, 2024, '2024-03-31', 'GT', 'PBKS', 'Narendra Modi Stadium, Ahmedabad'),
  (2410, 2024, '2024-04-01', 'DC', 'MI', 'Arun Jaitley Stadium, Delhi'),
  (2411, 2024, '2024-04-03', 'CSK', 'RR', 'MA Chidambaram Stadium, Chennai'),
  (2412, 2024, '2024-04-04', 'KKR', 'LSG', 'Eden Gardens, Kolkata'),
  (2413, 2024, '2024-04-05', 'GT', 'SRH', 'Narendra Modi Stadium, Ahmedabad'),
  (2414, 2024, '2024-04-06', 'RCB', 'MI', 'M. Chinnaswamy Stadium, Bengaluru'),
  (2415, 2024, '2024-04-07', 'DC', 'PBKS', 'Arun Jaitley Stadium, Delhi'),
  (2416, 2024, '2024-04-09', 'LSG', 'CSK', 'Ekana Cricket Stadium, Lucknow'),
  (2417, 2024, '2024-04-10', 'GT', 'RR', 'Narendra Modi Stadium, Ahmedabad'),
  (2418, 2024, '2024-04-11', 'KKR', 'MI', 'Eden Gardens, Kolkata'),
  (2419, 2024, '2024-04-12', 'DC', 'SRH', 'Arun Jaitley Stadium, Delhi'),
  (2420, 2024, '2024-04-13', 'RCB', 'PBKS', 'M. Chinnaswamy Stadium, Bengaluru'),
  (2421, 2024, '2024-04-15', 'CSK', 'GT', 'MA Chidambaram Stadium, Chennai'),
  (2422, 2024, '2024-04-16', 'LSG', 'MI', 'Ekana Cricket Stadium, Lucknow'),
  (2423, 2024, '2024-04-17', 'DC', 'RR', 'Arun Jaitley Stadium, Delhi'),
  (2424, 2024, '2024-04-18', 'KKR', 'PBKS', 'Eden Gardens, Kolkata'),
  (2425, 2024, '2024-04-19', 'RCB', 'SRH', 'M. Chinnaswamy Stadium, Bengaluru'),
  (2426, 2024, '2024-04-21', 'MI', 'CSK', 'Wankhede Stadium, Mumbai'),
  (2427, 2024, '2024-04-22', 'DC', 'GT', 'Arun Jaitley Stadium, Delhi'),
  (2428, 2024, '2024-04-23', 'LSG', 'PBKS', 'Ekana Cricket Stadium, Lucknow'),
  (2429, 2024, '2024-04-24', 'RCB', 'RR', 'M. Chinnaswamy Stadium, Bengaluru'),
  (2430, 2024, '2024-04-25', 'KKR', 'SRH', 'Eden Gardens, Kolkata'),
  (2431, 2024, '2024-04-27', 'CSK', 'DC', 'MA Chidambaram Stadium, Chennai'),
  (2432, 2024, '2024-04-28', 'MI', 'PBKS', 'Wankhede Stadium, Mumbai'),
  (2433, 2024, '2024-04-29', 'RCB', 'GT', 'M. Chinnaswamy Stadium, Bengaluru'),
  (2434, 2024, '2024-04-30', 'LSG', 'SRH', 'Ekana Cricket Stadium, Lucknow'),
  (2435, 2024, '2024-05-01', 'KKR', 'RR', 'Eden Gardens, Kolkata'),
  (2436, 2024, '2024-05-03', 'PBKS', 'CSK', 'PCA Stadium, Mullanpur'),
  (2437, 2024, '2024-05-04', 'RCB', 'DC', 'M. Chinnaswamy Stadium, Bengaluru'),
  (2438, 2024, '2024-05-05', 'MI', 'SRH', 'Wankhede Stadium, Mumbai'),
  (2439, 2024, '2024-05-06', 'KKR', 'GT', 'Eden Gardens, Kolkata'),
  (2440, 2024, '2024-05-07', 'LSG', 'RR', 'Ekana Cricket Stadium, Lucknow'),
  (2301, 2023, '2023-05-08', 'CSK', 'PBKS', 'MA Chidambaram Stadium, Chennai'),
  (2302, 2023, '2023-05-09', 'DC', 'RCB', 'Arun Jaitley Stadium, Delhi'),
  (2303, 2023, '2023-05-10', 'SRH', 'MI', 'Rajiv Gandhi Intl. Stadium, Hyderabad'),
  (2304, 2023, '2023-05-11', 'GT', 'KKR', 'Narendra Modi Stadium, Ahmedabad'),
  (2305, 2023, '2023-05-12', 'RR', 'LSG', 'Sawai Mansingh Stadium, Jaipur'),
  (2306, 2023, '2023-05-14', 'RCB', 'CSK', 'M. Chinnaswamy Stadium, Bengaluru'),
  (2307, 2023, '2023-05-15', 'SRH', 'PBKS', 'Rajiv Gandhi Intl. Stadium, Hyderabad'),
  (2308, 2023, '2023-05-16', 'DC', 'KKR', 'Arun Jaitley Stadium, Delhi'),
  (2309, 2023, '2023-05-17', 'RR', 'MI', 'Sawai Mansingh Stadium, Jaipur'),
  (2310, 2023, '2023-05-18', 'GT', 'LSG', 'Narendra Modi Stadium, Ahmedabad');

-- Virat Kohli (RCB): a 5-match streak is ONE row, not three overlapping 3-match windows.
INSERT INTO batting_innings (match_id, player_id, runs, balls) VALUES
  (2302, 1, 18, 13), -- 2023-05-09 DC v RCB
  (2306, 1, 9, 6), -- 2023-05-14 RCB v CSK
  (2402, 1, 45, 32), -- 2024-03-23 RCB v KKR
  (2408, 1, 77, 55), -- 2024-03-30 RCB v LSG
  (2414, 1, 31, 22), -- 2024-04-06 RCB v MI
  (2420, 1, 52, 37), -- 2024-04-13 RCB v PBKS
  (2425, 1, 30, 21), -- 2024-04-19 RCB v SRH
  (2429, 1, 11, 8), -- 2024-04-24 RCB v RR
  (2433, 1, 63, 45), -- 2024-04-29 RCB v GT
  (2437, 1, 5, 4); -- 2024-05-04 RCB v DC

-- Ruturaj Gaikwad (CSK): a streak of exactly 3 that ends on exactly 30 runs.
INSERT INTO batting_innings (match_id, player_id, runs, balls) VALUES
  (2301, 2, 40, 30), -- 2023-05-08 CSK v PBKS
  (2306, 2, 12, 9), -- 2023-05-14 RCB v CSK
  (2401, 2, 14, 10), -- 2024-03-22 CSK v SRH
  (2406, 2, 46, 34), -- 2024-03-28 KKR v CSK
  (2411, 2, 61, 45), -- 2024-04-03 CSK v RR
  (2416, 2, 30, 22), -- 2024-04-09 LSG v CSK
  (2421, 2, 8, 6), -- 2024-04-15 CSK v GT
  (2426, 2, 22, 16), -- 2024-04-21 MI v CSK
  (2431, 2, 29, 21), -- 2024-04-27 CSK v DC
  (2436, 2, 19, 14); -- 2024-05-03 PBKS v CSK

-- Travis Head (SRH): two separate streaks in one season are both reported.
INSERT INTO batting_innings (match_id, player_id, runs, balls) VALUES
  (2303, 3, 5, 3), -- 2023-05-10 SRH v MI
  (2307, 3, 21, 11), -- 2023-05-15 SRH v PBKS
  (2401, 3, 89, 47), -- 2024-03-22 CSK v SRH
  (2407, 3, 34, 18), -- 2024-03-29 RR v SRH
  (2413, 3, 102, 54), -- 2024-04-05 GT v SRH
  (2419, 3, 0, 2), -- 2024-04-12 DC v SRH
  (2425, 3, 62, 33), -- 2024-04-19 RCB v SRH
  (2430, 3, 31, 16), -- 2024-04-25 KKR v SRH
  (2434, 3, 58, 31), -- 2024-04-30 LSG v SRH
  (2438, 3, 44, 23); -- 2024-05-05 MI v SRH

-- Abhishek Sharma (SRH): 29 is not 30+: it breaks what would otherwise be a 5-match run.
INSERT INTO batting_innings (match_id, player_id, runs, balls) VALUES
  (2401, 4, 32, 16), -- 2024-03-22 CSK v SRH
  (2407, 4, 63, 32), -- 2024-03-29 RR v SRH
  (2413, 4, 29, 15), -- 2024-04-05 GT v SRH
  (2419, 4, 46, 23), -- 2024-04-12 DC v SRH
  (2425, 4, 37, 19), -- 2024-04-19 RCB v SRH
  (2430, 4, 12, 6), -- 2024-04-25 KKR v SRH
  (2434, 4, 75, 38), -- 2024-04-30 LSG v SRH
  (2438, 4, 8, 4); -- 2024-05-05 MI v SRH

-- Phil Salt (KKR): 30 counts as 30+ (>= 30, not > 30).
INSERT INTO batting_innings (match_id, player_id, runs, balls) VALUES
  (2402, 5, 30, 17), -- 2024-03-23 RCB v KKR
  (2406, 5, 30, 17), -- 2024-03-28 KKR v CSK
  (2412, 5, 30, 17), -- 2024-04-04 KKR v LSG
  (2418, 5, 4, 2), -- 2024-04-11 KKR v MI
  (2424, 5, 18, 10), -- 2024-04-18 KKR v PBKS
  (2430, 5, 9, 5), -- 2024-04-25 KKR v SRH
  (2435, 5, 27, 15), -- 2024-05-01 KKR v RR
  (2439, 5, 12, 7); -- 2024-05-06 KKR v GT

-- Sanju Samson (RR): four 30+ scores that never fall in consecutive matches are excluded.
INSERT INTO batting_innings (match_id, player_id, runs, balls) VALUES
  (2403, 6, 82, 53), -- 2024-03-24 RR v PBKS
  (2407, 6, 15, 10), -- 2024-03-29 RR v SRH
  (2411, 6, 68, 44), -- 2024-04-03 CSK v RR
  (2417, 6, 21, 14), -- 2024-04-10 GT v RR
  (2423, 6, 71, 46), -- 2024-04-17 DC v RR
  (2429, 6, 3, 2), -- 2024-04-24 RCB v RR
  (2435, 6, 38, 25), -- 2024-05-01 KKR v RR
  (2440, 6, 26, 17); -- 2024-05-07 LSG v RR

-- KL Rahul (LSG): "consecutive" means consecutive innings: a match the player did not bat in does not break the streak.
--   Did not bat: 2024 match 3.
INSERT INTO batting_innings (match_id, player_id, runs, balls) VALUES
  (2404, 7, 58, 45), -- 2024-03-25 DC v LSG
  (2408, 7, 33, 25), -- 2024-03-30 RCB v LSG
  (2416, 7, 47, 36), -- 2024-04-09 LSG v CSK
  (2422, 7, 9, 7), -- 2024-04-16 LSG v MI
  (2428, 7, 15, 12), -- 2024-04-23 LSG v PBKS
  (2434, 7, 3, 2), -- 2024-04-30 LSG v SRH
  (2440, 7, 20, 15); -- 2024-05-07 LSG v RR

-- Shubman Gill (GT): a run spanning the 2023 -> 2024 seasons must not count as a 2024 streak.
INSERT INTO batting_innings (match_id, player_id, runs, balls) VALUES
  (2304, 8, 36, 26), -- 2023-05-11 GT v KKR
  (2310, 8, 52, 37), -- 2023-05-18 GT v LSG
  (2405, 8, 41, 29), -- 2024-03-26 GT v MI
  (2409, 8, 33, 24), -- 2024-03-31 GT v PBKS
  (2413, 8, 2, 1), -- 2024-04-05 GT v SRH
  (2417, 8, 19, 14), -- 2024-04-10 GT v RR
  (2421, 8, 55, 39), -- 2024-04-15 CSK v GT
  (2427, 8, 7, 5), -- 2024-04-22 DC v GT
  (2433, 8, 28, 20), -- 2024-04-29 RCB v GT
  (2439, 8, 12, 9); -- 2024-05-06 KKR v GT

-- Rohit Sharma (MI): big scores in isolation are not a streak.
INSERT INTO batting_innings (match_id, player_id, runs, balls) VALUES
  (2303, 9, 2, 1), -- 2023-05-10 SRH v MI
  (2309, 9, 29, 19), -- 2023-05-17 RR v MI
  (2405, 9, 43, 29), -- 2024-03-26 GT v MI
  (2410, 9, 49, 33), -- 2024-04-01 DC v MI
  (2414, 9, 8, 5), -- 2024-04-06 RCB v MI
  (2418, 9, 26, 17), -- 2024-04-11 KKR v MI
  (2422, 9, 105, 70), -- 2024-04-16 LSG v MI
  (2426, 9, 4, 3), -- 2024-04-21 MI v CSK
  (2432, 9, 36, 24), -- 2024-04-28 MI v PBKS
  (2438, 9, 19, 13); -- 2024-05-05 MI v SRH

-- Jasprit Bumrah (MI): a tail-ender with gaps and ducks produces nothing.
--   Did not bat: 2024 match 2, 2024 match 4, 2024 match 7.
INSERT INTO batting_innings (match_id, player_id, runs, balls) VALUES
  (2405, 10, 0, 2), -- 2024-03-26 GT v MI
  (2414, 10, 4, 4), -- 2024-04-06 RCB v MI
  (2422, 10, 1, 1), -- 2024-04-16 LSG v MI
  (2426, 10, 0, 2), -- 2024-04-21 MI v CSK
  (2438, 10, 2, 2); -- 2024-05-05 MI v SRH

-- Rishabh Pant (DC): rows inserted out of date order are still ordered by match date.
--   Rows deliberately inserted newest-first.
INSERT INTO batting_innings (match_id, player_id, runs, balls) VALUES
  (2437, 11, 27, 17), -- 2024-05-04 RCB v DC
  (2431, 11, 24, 15), -- 2024-04-27 CSK v DC
  (2427, 11, 18, 11), -- 2024-04-22 DC v GT
  (2423, 11, 6, 4), -- 2024-04-17 DC v RR
  (2419, 11, 39, 24), -- 2024-04-12 DC v SRH
  (2415, 11, 55, 34), -- 2024-04-07 DC v PBKS
  (2410, 11, 41, 26), -- 2024-04-01 DC v MI
  (2404, 11, 10, 6); -- 2024-03-25 DC v LSG

-- Shashank Singh (PBKS): background player with no streak.
INSERT INTO batting_innings (match_id, player_id, runs, balls) VALUES
  (2403, 12, 21, 12), -- 2024-03-24 RR v PBKS
  (2409, 12, 8, 5), -- 2024-03-31 GT v PBKS
  (2415, 12, 61, 36), -- 2024-04-07 DC v PBKS
  (2420, 12, 25, 15), -- 2024-04-13 RCB v PBKS
  (2424, 12, 14, 8), -- 2024-04-18 KKR v PBKS
  (2428, 12, 0, 2), -- 2024-04-23 LSG v PBKS
  (2432, 12, 32, 19), -- 2024-04-28 MI v PBKS
  (2436, 12, 18, 11); -- 2024-05-03 PBKS v CSK
