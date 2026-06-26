-- 0001_init.sql — initial schema for Kongsi Bill
-- Target: Cloudflare D1 (SQLite). See docs/blueprint.md §6 for the data model.
--
-- Conventions enforced here:
--   * SQLite-native types only: TEXT, INTEGER, REAL. No VARCHAR / DATE / BOOLEAN.
--   * Dates are TEXT in 'YYYY-MM-DD' (blueprint §6.6). No time, no timezone.
--     The format is a Worker-enforced convention, not a SQL type.
--   * Booleans are INTEGER 0/1 (SQLite has no boolean).
--   * IDs are app-generated random TEXT strings used as PRIMARY KEY (no
--     AUTOINCREMENT). house_id doubles as the public room ID.
--   * Every table carries schema_version INTEGER NOT NULL DEFAULT 1.
--
-- Foreign keys: D1 enforces FK constraints, so members/presence/bills are
-- linked back to their house (and presence back to its member).

-- 6.1 House — house_id is also the public room ID / storage key.
CREATE TABLE houses (
  house_id        TEXT PRIMARY KEY,
  member_code     TEXT NOT NULL,
  admin_code      TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  created_at      TEXT NOT NULL,                 -- 'YYYY-MM-DD'
  schema_version  INTEGER NOT NULL DEFAULT 1
);

-- 6.2 Member (housemate) — active=0 means soft-removed; the row stays attached
-- to past bills so history reconciles (blueprint §6.7).
CREATE TABLE members (
  member_id       TEXT PRIMARY KEY,
  house_id        TEXT NOT NULL,
  name            TEXT NOT NULL,
  active          INTEGER NOT NULL DEFAULT 1,    -- boolean 0/1
  schema_version  INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (house_id) REFERENCES houses(house_id)
);

-- 6.3 Presence record — one row PER date range (not a JSON blob). A member may
-- own several ranges; overlapping/duplicate ranges are merged in the Worker on
-- save, not in SQL. "start"/"end" are quoted because END is a SQLite keyword —
-- they must be quoted wherever queried too.
CREATE TABLE presence_ranges (
  range_id        TEXT PRIMARY KEY,
  member_id       TEXT NOT NULL,
  "start"         TEXT NOT NULL,                 -- 'YYYY-MM-DD', inclusive
  "end"           TEXT NOT NULL,                 -- 'YYYY-MM-DD', inclusive
  schema_version  INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (member_id) REFERENCES members(member_id)
);

-- 6.4 Bill — amount is REAL for record-keeping ONLY. The actual split
-- (day-weighted shares, cent rounding/reconciliation) is computed in the browser
-- in TypeScript (src/calc.ts), never in SQL, so float storage never feeds a
-- calculation. status follows the blueprint lifecycle (draft -> confirmed ->
-- locked); confirmed_at starts the 7-day grace window and is null until confirmed.
CREATE TABLE bills (
  bill_id         TEXT PRIMARY KEY,
  house_id        TEXT NOT NULL,
  utility_label   TEXT NOT NULL,                 -- free text: "Electricity", "Water", …
  amount          REAL NOT NULL,                 -- record-keeping only; not used to compute splits
  period_start    TEXT NOT NULL,                 -- 'YYYY-MM-DD', inclusive
  period_end      TEXT NOT NULL,                 -- 'YYYY-MM-DD', inclusive
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'confirmed', 'locked')),
  confirmed_at    TEXT,                          -- 'YYYY-MM-DD', nullable (starts grace window)
  schema_version  INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (house_id) REFERENCES houses(house_id)
);

-- Indexes on the foreign-key columns we read by: almost every query is
-- "everything for house X" (and presence by member).
CREATE INDEX idx_members_house_id        ON members(house_id);
CREATE INDEX idx_presence_ranges_member  ON presence_ranges(member_id);
CREATE INDEX idx_bills_house_id          ON bills(house_id);
