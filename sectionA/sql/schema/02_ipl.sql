-- Scenario 2 schema: an IPL-style batting dataset.
-- PostgreSQL dialect (runs unchanged on PostgreSQL 12+ and on PGlite).

CREATE TABLE players (
  player_id    INT          PRIMARY KEY,
  player_name  VARCHAR(80)  NOT NULL,
  team         VARCHAR(4)   NOT NULL          -- franchise code, e.g. RCB, CSK
);

CREATE TABLE matches (
  match_id     INT          PRIMARY KEY,
  season       INT          NOT NULL,         -- IPL season year
  match_date   DATE         NOT NULL,
  home_team    VARCHAR(4)   NOT NULL,
  away_team    VARCHAR(4)   NOT NULL,
  venue        VARCHAR(80)  NOT NULL,
  CHECK (home_team <> away_team)
);

-- One row per player per match in which the player batted.
-- A player who was in the XI but did not bat has no row for that match.
CREATE TABLE batting_innings (
  match_id     INT  NOT NULL REFERENCES matches (match_id),
  player_id    INT  NOT NULL REFERENCES players (player_id),
  runs         INT  NOT NULL CHECK (runs >= 0),
  balls        INT  NOT NULL CHECK (balls >= 0),
  PRIMARY KEY (match_id, player_id)
);

CREATE INDEX ix_matches_season_date ON matches (season, match_date);
