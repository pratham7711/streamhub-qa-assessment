-- ANTI-PATTERN, kept on purpose to prove the tests can fail.
-- It looks reasonable but uses an ABSOLUTE time difference and no self-transfer
-- filter, so every round trip is reported twice (once in each direction) and
-- self-transfers "return" to themselves. tests/features/sql runs it and expects
-- the oracle comparison to FAIL.
SELECT
  s.from_account                                                        AS account_a,
  s.to_account                                                          AS account_b,
  s.txn_id                                                              AS sent_txn_id,
  s.amount                                                              AS sent_amount,
  TO_CHAR(s.txn_time, 'YYYY-MM-DD HH24:MI:SS')                          AS sent_at,
  r.txn_id                                                              AS returned_txn_id,
  r.amount                                                              AS returned_amount,
  TO_CHAR(r.txn_time, 'YYYY-MM-DD HH24:MI:SS')                          AS returned_at,
  ROUND(ABS(EXTRACT(EPOCH FROM (r.txn_time - s.txn_time))) / 3600, 2)   AS hours_apart,
  ROUND(ABS(r.amount - s.amount) * 100 / s.amount, 3)                   AS pct_difference
FROM transactions AS s
JOIN transactions AS r
  ON  r.from_account = s.to_account
  AND r.to_account   = s.from_account
  AND r.txn_id      <> s.txn_id
  AND ABS(EXTRACT(EPOCH FROM (r.txn_time - s.txn_time))) <= 86400
  AND ABS(r.amount - s.amount) <= 0.10 * s.amount
ORDER BY s.txn_time, s.txn_id, r.txn_time, r.txn_id;
