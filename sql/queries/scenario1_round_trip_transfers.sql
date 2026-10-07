-- Scenario 1: quick round-trip transfers (possible reversals or wash transfers).
--
-- Report every pair of transfers where
--   * account A sends money to account B ("sent"), and
--   * B later sends money back to A ("returned"),
--   * at most 24 hours after the sent transfer (inclusive), and
--   * the returned amount is within 10% of the SENT amount (inclusive):
--       |returned - sent| <= 0.10 * sent
--
-- Assumptions (see sql/README.md):
--   * "Back" means strictly later; the earlier transfer is the original, so a
--     pair is reported once, never again with A and B swapped.
--   * Self-transfers (from = to) are not round trips.
--   * Every qualifying pair is reported: one transfer with two qualifying
--     returns yields two rows. Add "DISTINCT ON (s.txn_id)" to keep only the
--     first return per sent transfer.
--   * To measure 10% against the larger of the two amounts instead, replace
--     "0.10 * s.amount" with "0.10 * GREATEST(s.amount, r.amount)".
WITH transfers AS (
  SELECT txn_id, from_account, to_account, amount, txn_time
  FROM transactions
  WHERE from_account <> to_account
)
SELECT
  s.from_account                                                   AS account_a,
  s.to_account                                                     AS account_b,
  s.txn_id                                                         AS sent_txn_id,
  s.amount                                                         AS sent_amount,
  TO_CHAR(s.txn_time, 'YYYY-MM-DD HH24:MI:SS')                     AS sent_at,
  r.txn_id                                                         AS returned_txn_id,
  r.amount                                                         AS returned_amount,
  TO_CHAR(r.txn_time, 'YYYY-MM-DD HH24:MI:SS')                     AS returned_at,
  ROUND(EXTRACT(EPOCH FROM (r.txn_time - s.txn_time)) / 3600, 2)   AS hours_apart,
  ROUND(ABS(r.amount - s.amount) * 100 / s.amount, 3)              AS pct_difference
FROM transfers AS s
JOIN transfers AS r
  ON  r.from_account = s.to_account                          -- B sends ...
  AND r.to_account   = s.from_account                        -- ... back to A
  AND r.txn_time     >  s.txn_time                           -- strictly after the original
  AND r.txn_time     <= s.txn_time + INTERVAL '24 hours'     -- within 24 hours, inclusive
  AND ABS(r.amount - s.amount) <= 0.10 * s.amount            -- within 10% of the original
ORDER BY s.txn_time, s.txn_id, r.txn_time, r.txn_id;
