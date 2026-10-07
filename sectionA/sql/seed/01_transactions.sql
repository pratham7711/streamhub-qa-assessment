-- Scenario 1 seed data: synthetic accounts and transfers (March 2024).
-- Each numbered case below isolates ONE rule of the round-trip definition,
-- using its own pair of accounts so cases cannot interfere with each other.
--
-- Definition under test:
--   A -> B, then B -> A (a later transfer), no more than 24 hours after the first,
--   and |returned - sent| <= 10% of the SENT (original) amount.

INSERT INTO accounts (account_id, holder_name) VALUES
  ('AC101', 'Aarav Mehta'),      ('AC201', 'Bhavna Iyer'),
  ('AC102', 'Kabir Rao'),        ('AC202', 'Diya Kapoor'),
  ('AC103', 'Rohan Gupta'),      ('AC203', 'Meera Nair'),
  ('AC104', 'Ishaan Verma'),     ('AC204', 'Saanvi Joshi'),
  ('AC105', 'Arjun Reddy'),      ('AC205', 'Kavya Pillai'),
  ('AC106', 'Nikhil Desai'),     ('AC206', 'Tara Bose'),
  ('AC107', 'Vivaan Saxena'),    ('AC207', 'Riya Chopra'),
  ('AC108', 'Aditya Malhotra'),
  ('AC109', 'Karan Sharma'),     ('AC209', 'Pooja Iyer'),     ('AC309', 'Neha Rao'),
  ('AC110', 'Siddharth Jain'),   ('AC210', 'Ananya Das'),
  ('AC111', 'Dev Khanna'),       ('AC211', 'Priya Menon'),
  ('AC112', 'Yash Agarwal'),     ('AC212', 'Ira Sethi'),
  ('AC113', 'Om Bhatt'),         ('AC213', 'Zoya Qureshi'),
  ('AC120', 'Acme Payroll Ltd'), ('AC130', 'Greenfield Rentals');

INSERT INTO transactions (txn_id, from_account, to_account, amount, txn_time) VALUES
  -- Case 1: plain round trip, same amount, 2.5 hours later.            -> REPORTED
  ('TX0101', 'AC101', 'AC201', 25000.00, '2024-03-01 09:00:00'),
  ('TX0102', 'AC201', 'AC101', 25000.00, '2024-03-01 11:30:00'),

  -- Case 2: return exactly 24h 00m 00s later (window is inclusive).    -> REPORTED
  ('TX0201', 'AC102', 'AC202', 10000.00, '2024-03-02 10:00:00'),
  ('TX0202', 'AC202', 'AC102',  9800.00, '2024-03-03 10:00:00'),

  -- Case 3: return 24h 00m 01s later, one second outside the window.   -> NOT reported
  ('TX0301', 'AC103', 'AC203', 10000.00, '2024-03-04 10:00:00'),
  ('TX0302', 'AC203', 'AC103', 10000.00, '2024-03-05 10:00:01'),

  -- Case 4: return exactly 10% LESS than sent (boundary is inclusive).  -> REPORTED
  ('TX0401', 'AC104', 'AC204', 20000.00, '2024-03-06 09:00:00'),
  ('TX0402', 'AC204', 'AC104', 18000.00, '2024-03-06 15:00:00'),

  -- Case 5: return exactly 10% MORE than sent (boundary is inclusive).  -> REPORTED
  ('TX0501', 'AC105', 'AC205', 20000.00, '2024-03-07 09:00:00'),
  ('TX0502', 'AC205', 'AC105', 22000.00, '2024-03-07 21:00:00'),

  -- Case 6: returns one paisa outside 10%, below and above.            -> NOT reported
  ('TX0601', 'AC106', 'AC206', 20000.00, '2024-03-08 09:00:00'),
  ('TX0602', 'AC206', 'AC106', 17999.99, '2024-03-08 10:00:00'),
  ('TX0603', 'AC206', 'AC106', 22000.01, '2024-03-08 11:00:00'),

  -- Case 7: the "return" is OLDER than the "original". The earlier transfer
  -- is the original, so the pair is reported once, with AC207 as account A,
  -- never a second time in the reverse direction.                      -> REPORTED once
  ('TX0701', 'AC207', 'AC107', 15000.00, '2024-03-09 08:00:00'),
  ('TX0702', 'AC107', 'AC207', 15000.00, '2024-03-09 10:00:00'),

  -- Case 8: self-transfers (from = to) would otherwise "return" to themselves. -> NOT reported
  ('TX0801', 'AC108', 'AC108',  5000.00, '2024-03-10 09:00:00'),
  ('TX0802', 'AC108', 'AC108',  5000.00, '2024-03-10 09:30:00'),

  -- Case 9: money comes back via a third account (A -> B -> C -> A).
  -- B never sends to A directly, so this is not a two-party round trip. -> NOT reported
  ('TX0901', 'AC109', 'AC209', 30000.00, '2024-03-11 09:00:00'),
  ('TX0902', 'AC209', 'AC309', 30000.00, '2024-03-11 10:00:00'),
  ('TX0903', 'AC309', 'AC109', 30000.00, '2024-03-11 11:00:00'),

  -- Case 10: one original, two qualifying returns (2% and 5% off).     -> REPORTED twice
  ('TX1001', 'AC110', 'AC210', 50000.00, '2024-03-12 09:00:00'),
  ('TX1002', 'AC210', 'AC110', 49000.00, '2024-03-12 11:00:00'),
  ('TX1003', 'AC210', 'AC110', 52500.00, '2024-03-12 18:00:00'),

  -- Case 11: a chain A -> B -> A -> B. Each leg reverses the previous one,
  -- so two overlapping pairs are reported (TX1101->TX1102, TX1102->TX1103).
  ('TX1101', 'AC111', 'AC211', 40000.00, '2024-03-13 09:00:00'),
  ('TX1102', 'AC211', 'AC111', 40000.00, '2024-03-13 13:00:00'),
  ('TX1103', 'AC111', 'AC211', 39000.00, '2024-03-13 20:00:00'),

  -- Case 12: right accounts, right time, wrong amount (95% smaller).   -> NOT reported
  ('TX1201', 'AC112', 'AC212', 100000.00, '2024-03-14 09:00:00'),
  ('TX1202', 'AC212', 'AC112',   5000.00, '2024-03-14 10:00:00'),

  -- Case 13: paisa-level precision at the 10% boundary.
  -- 10% of 333.33 is 33.333; a return of 366.66 differs by 33.33 (inside),
  -- a return of 366.67 differs by 33.34 (outside).                     -> 1 REPORTED, 1 NOT
  ('TX1301', 'AC113', 'AC213',   333.33, '2024-03-15 09:00:00'),
  ('TX1302', 'AC213', 'AC113',   366.66, '2024-03-15 09:45:00'),
  ('TX1303', 'AC213', 'AC113',   366.67, '2024-03-15 10:00:00'),

  -- Background noise: one-way payments that must never match anything.
  ('TX9001', 'AC120', 'AC101', 85000.00, '2024-03-01 00:05:00'),
  ('TX9002', 'AC101', 'AC130', 22000.00, '2024-03-05 09:00:00'),
  ('TX9003', 'AC201', 'AC130',  7500.00, '2024-03-06 12:00:00'),
  ('TX9004', 'AC120', 'AC202', 64000.00, '2024-03-01 00:05:00');
