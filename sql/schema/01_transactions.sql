-- Scenario 1 schema: accounts and the transfers between them.
-- PostgreSQL dialect (runs unchanged on PostgreSQL 12+ and on PGlite).
-- Money is NUMERIC(12,2): exact decimal arithmetic, so the "within 10%"
-- boundary is decided exactly (a FLOAT column could misjudge it by 1e-16).

CREATE TABLE accounts (
  account_id   VARCHAR(12)  PRIMARY KEY,
  holder_name  VARCHAR(80)  NOT NULL
);

CREATE TABLE transactions (
  txn_id        VARCHAR(12)    PRIMARY KEY,
  from_account  VARCHAR(12)    NOT NULL REFERENCES accounts (account_id),
  to_account    VARCHAR(12)    NOT NULL REFERENCES accounts (account_id),
  amount        NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  txn_time      TIMESTAMP      NOT NULL
);

-- Supports the self-join: find B -> A transfers for a given A -> B in a time range.
CREATE INDEX ix_transactions_pair_time ON transactions (from_account, to_account, txn_time);
