/**
 * Synthetic IPL-style batting data for SQL scenario 2. Player and team names
 * are real IPL names for readability; every score and date is invented.
 *
 * sql/scripts/build-ipl-seed.ts turns this file into sql/seed/02_ipl.sql.
 * The tests never read this file: the oracle reads the loaded database tables.
 *
 * runs[i] is the player's score in the team's i-th match of the season;
 * null means the player was in the side but did not bat (no batting_innings row).
 */
export const TEAMS = {
  CSK: 'MA Chidambaram Stadium, Chennai',
  RCB: 'M. Chinnaswamy Stadium, Bengaluru',
  SRH: 'Rajiv Gandhi Intl. Stadium, Hyderabad',
  KKR: 'Eden Gardens, Kolkata',
  RR: 'Sawai Mansingh Stadium, Jaipur',
  LSG: 'Ekana Cricket Stadium, Lucknow',
  GT: 'Narendra Modi Stadium, Ahmedabad',
  MI: 'Wankhede Stadium, Mumbai',
  DC: 'Arun Jaitley Stadium, Delhi',
  PBKS: 'PCA Stadium, Mullanpur',
} as const;

export type Team = keyof typeof TEAMS;

/** Each team plays once per round. 2023 contributes the last two rounds of that season. */
export const SEASONS = [
  { season: 2023, rounds: 2, firstMatchId: 2301, firstDate: '2023-05-08' },
  { season: 2024, rounds: 8, firstMatchId: 2401, firstDate: '2024-03-22' },
] as const;

export interface PlayerFixture {
  id: number;
  name: string;
  team: Team;
  strikeRate: number;
  runs: Partial<Record<2023 | 2024, Array<number | null>>>;
  /** Why this player is in the dataset: the edge case it proves. */
  proves: string;
  insertInReverse?: boolean;
}

export const PLAYERS: PlayerFixture[] = [
  { id: 1, name: 'Virat Kohli', team: 'RCB', strikeRate: 1.4,
    runs: { 2023: [18, 9], 2024: [45, 77, 31, 52, 30, 11, 63, 5] },
    proves: 'a 5-match streak is ONE row, not three overlapping 3-match windows' },
  { id: 2, name: 'Ruturaj Gaikwad', team: 'CSK', strikeRate: 1.35,
    runs: { 2023: [40, 12], 2024: [14, 46, 61, 30, 8, 22, 29, 19] },
    proves: 'a streak of exactly 3 that ends on exactly 30 runs' },
  { id: 3, name: 'Travis Head', team: 'SRH', strikeRate: 1.9,
    runs: { 2023: [5, 21], 2024: [89, 34, 102, 0, 62, 31, 58, 44] },
    proves: 'two separate streaks in one season are both reported' },
  { id: 4, name: 'Abhishek Sharma', team: 'SRH', strikeRate: 2.0,
    runs: { 2024: [32, 63, 29, 46, 37, 12, 75, 8] },
    proves: '29 is not 30+: it breaks what would otherwise be a 5-match run' },
  { id: 5, name: 'Phil Salt', team: 'KKR', strikeRate: 1.8,
    runs: { 2024: [30, 30, 30, 4, 18, 9, 27, 12] },
    proves: '30 counts as 30+ (>= 30, not > 30)' },
  { id: 6, name: 'Sanju Samson', team: 'RR', strikeRate: 1.55,
    runs: { 2024: [82, 15, 68, 21, 71, 3, 38, 26] },
    proves: 'four 30+ scores that never fall in consecutive matches are excluded' },
  { id: 7, name: 'KL Rahul', team: 'LSG', strikeRate: 1.3,
    runs: { 2024: [58, 33, null, 47, 9, 15, 3, 20] },
    proves: '"consecutive" means consecutive innings: a match the player did not bat in does not break the streak' },
  { id: 8, name: 'Shubman Gill', team: 'GT', strikeRate: 1.4,
    runs: { 2023: [36, 52], 2024: [41, 33, 2, 19, 55, 7, 28, 12] },
    proves: 'a run spanning the 2023 -> 2024 seasons must not count as a 2024 streak' },
  { id: 9, name: 'Rohit Sharma', team: 'MI', strikeRate: 1.5,
    runs: { 2023: [2, 29], 2024: [43, 49, 8, 26, 105, 4, 36, 19] },
    proves: 'big scores in isolation are not a streak' },
  { id: 10, name: 'Jasprit Bumrah', team: 'MI', strikeRate: 0.9,
    runs: { 2024: [0, null, 4, null, 1, 0, null, 2] },
    proves: 'a tail-ender with gaps and ducks produces nothing' },
  { id: 11, name: 'Rishabh Pant', team: 'DC', strikeRate: 1.6,
    runs: { 2024: [10, 41, 55, 39, 6, 18, 24, 27] },
    proves: 'rows inserted out of date order are still ordered by match date', insertInReverse: true },
  { id: 12, name: 'Shashank Singh', team: 'PBKS', strikeRate: 1.7,
    runs: { 2024: [21, 8, 61, 25, 14, 0, 32, 18] },
    proves: 'background player with no streak' },
];
