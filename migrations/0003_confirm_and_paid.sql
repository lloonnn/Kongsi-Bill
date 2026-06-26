-- 0003_confirm_and_paid.sql — finalization lifecycle support.
--
-- Two additions, both driven by the admin's real workflow (collect days →
-- announce fees → collect money → pay landlord → close):
--
--   1. members.days_confirmed — a per-member boolean ("I've reviewed my days and
--      they're correct"). Lets the admin see who is done before locking. It is
--      reset to 0 by the Worker whenever that member's presence changes, and set
--      to 1 by the new confirm-days endpoint.
--
--   2. bills.status gains 'paid' — the "settled / case closed" stage after
--      'confirmed'. Lifecycle is now: draft → confirmed → paid. SQLite can't
--      alter a CHECK constraint in place, so the bills table is rebuilt (same
--      dance as 0002). Safe: bills have no FK dependents.

-- 1. Per-member readiness flag (ADD COLUMN is supported directly).
ALTER TABLE members ADD COLUMN days_confirmed INTEGER NOT NULL DEFAULT 0;

-- 2. Widen the bills.status CHECK to include 'paid'.
CREATE TABLE bills_new (
  bill_id         TEXT PRIMARY KEY,
  house_id        TEXT NOT NULL,
  utility_label   TEXT NOT NULL,
  amount          REAL NOT NULL,
  period_start    TEXT NOT NULL,
  period_end      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'confirmed', 'paid')),
  schema_version  INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (house_id) REFERENCES houses(house_id)
);

INSERT INTO bills_new (bill_id, house_id, utility_label, amount, period_start, period_end, status, schema_version)
  SELECT bill_id, house_id, utility_label, amount, period_start, period_end, status, schema_version
  FROM bills;

DROP TABLE bills;
ALTER TABLE bills_new RENAME TO bills;

CREATE INDEX idx_bills_house_id ON bills(house_id);
