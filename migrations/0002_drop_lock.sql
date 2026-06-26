-- 0002_drop_lock.sql — remove the bill lock / grace-period model.
--
-- Design change: the 7-day grace period, bill locking, and admin override are
-- gone. bills.status is now just a label (draft | confirmed) with no
-- enforcement — it never blocks edits. So:
--   * tighten the CHECK from (draft|confirmed|locked) -> (draft|confirmed)
--   * drop the now-unused confirmed_at column (it started the grace window)
--
-- SQLite can't alter a CHECK constraint or rebuild a column type in place, so
-- this is the standard table-rebuild dance. Safe because there is no real data
-- yet and nothing has a FOREIGN KEY pointing at bills (only bills -> houses,
-- which is preserved below).

CREATE TABLE bills_new (
  bill_id         TEXT PRIMARY KEY,
  house_id        TEXT NOT NULL,
  utility_label   TEXT NOT NULL,                 -- free text: "Electricity", "Water", …
  amount          REAL NOT NULL,                 -- record-keeping only; splits are computed in the browser
  period_start    TEXT NOT NULL,                 -- 'YYYY-MM-DD', inclusive
  period_end      TEXT NOT NULL,                 -- 'YYYY-MM-DD', inclusive
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'confirmed')),   -- label only; never gates edits
  schema_version  INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (house_id) REFERENCES houses(house_id)
);

-- Copy forward every column except confirmed_at.
INSERT INTO bills_new (bill_id, house_id, utility_label, amount, period_start, period_end, status, schema_version)
  SELECT bill_id, house_id, utility_label, amount, period_start, period_end, status, schema_version
  FROM bills;

DROP TABLE bills;
ALTER TABLE bills_new RENAME TO bills;

-- The index was dropped along with the old table; recreate it.
CREATE INDEX idx_bills_house_id ON bills(house_id);
