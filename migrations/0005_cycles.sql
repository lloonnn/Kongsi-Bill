-- 0005_cycles.sql — group bills into explicit admin-named billing cycles.
--
-- The problem (rework brief): bills were a flat list with no grouping, so
-- "Calculate" acted across unrelated bills, bills from different periods got
-- combined, and the date-based freeze collided when bills from different periods
-- shared overlapping dates. Root cause: there was no concept of a billing cycle.
--
-- The model: bills are grouped into explicit, admin-named cycles (e.g.
-- "June 2026"). Calculate acts on ONE cycle; different cycles are fully
-- independent (overlapping dates across cycles are fine). This migration adds a
-- `cycles` table and a bills.cycle_id FK so the Worker/calc can scope per cycle.
--
-- Existing TEST bills are WIPED (product-owner confirmed) for a clean start —
-- there is no legacy cycle to backfill, and every bill from now on belongs to a
-- cycle. 0001–0004 are untouched; paid_snapshot (0004) is preserved on the
-- rebuilt bills table. Conventions follow 0001: SQLite-native types only, dates
-- as 'YYYY-MM-DD' TEXT, booleans/status as constrained TEXT, string PK IDs, and
-- schema_version INTEGER NOT NULL DEFAULT 1 on every row.

-- 1. Billing cycle — an admin-named period that owns that period's bills. status
--    is a label/lifecycle (open → finalized), mirroring how bills.status works:
--    it is set by the Worker on the admin's say-so and never computed here.
CREATE TABLE cycles (
  cycle_id        TEXT PRIMARY KEY,
  house_id        TEXT NOT NULL,
  display_name    TEXT NOT NULL,                 -- admin-typed, e.g. "June 2026"
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'finalized')),
  created_at      TEXT NOT NULL,                 -- 'YYYY-MM-DD'
  schema_version  INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (house_id) REFERENCES houses(house_id)
);

-- Almost every read is "the cycles for house X".
CREATE INDEX idx_cycles_house_id ON cycles(house_id);

-- 2. Rebuild bills to add cycle_id (NOT NULL FK). SQLite cannot ADD COLUMN a
--    NOT-NULL foreign key without a default, so this is the standard
--    table-rebuild dance (same as 0002 and 0003). Dropping the table also wipes
--    the existing test bills — the authorized clean start — so nothing is copied
--    forward (no INSERT … SELECT). `cycles` is created above, so the cycle_id FK
--    target already exists. The status CHECK (draft|confirmed|paid), the
--    paid_snapshot column (0004), and the houses FK are all preserved.
DROP TABLE bills;

CREATE TABLE bills (
  bill_id         TEXT PRIMARY KEY,
  house_id        TEXT NOT NULL,
  cycle_id        TEXT NOT NULL,                 -- the cycle this bill belongs to
  utility_label   TEXT NOT NULL,                 -- free text: "Electricity", "Water", …
  amount          REAL NOT NULL,                 -- record-keeping only; splits are computed in the browser
  period_start    TEXT NOT NULL,                 -- 'YYYY-MM-DD', inclusive
  period_end      TEXT NOT NULL,                 -- 'YYYY-MM-DD', inclusive
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'confirmed', 'paid')),
  paid_snapshot   TEXT,                          -- JSON text computed by the browser, or NULL (0004)
  schema_version  INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (house_id) REFERENCES houses(house_id),
  FOREIGN KEY (cycle_id) REFERENCES cycles(cycle_id)
);

-- Recreate the house index (dropped with the old table) and add a cycle index:
-- the per-cycle calculate reads "the bills for cycle X".
CREATE INDEX idx_bills_house_id  ON bills(house_id);
CREATE INDEX idx_bills_cycle_id  ON bills(cycle_id);
