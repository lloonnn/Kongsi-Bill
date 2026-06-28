// Tests for the re-scoped freeze guard (migration 0005), presenceHitsLock.
//
// Run with Node's built-in test runner + TypeScript type-stripping (no deps):
//   node --experimental-strip-types --test worker/freeze.test.ts
//
// worker/index.ts has no runtime imports and only constructs consts/functions at
// load time (crypto/btoa are used inside function bodies, never at import), so
// the module loads standalone here and we can exercise the pure predicate.

import test from 'node:test';
import assert from 'node:assert/strict';

import { presenceHitsLock } from './index.ts';

type PaidBill = { period_start: string; period_end: string; paid_snapshot: string | null };

// A member trying to edit their days for late June / early July.
const edit = [{ start: '2026-06-25', end: '2026-07-05' }];

test('blocks an edit overlapping a settled bill that has NO snapshot (protection kept)', () => {
  const unfrozenPaid: PaidBill = {
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    paid_snapshot: null, // legacy/edge: split would still recalc → must lock
  };
  assert.equal(presenceHitsLock(edit, [unfrozenPaid]), true);
});

test('allows an edit overlapping a settled bill that HAS a snapshot (already frozen)', () => {
  // The June bill is paid AND snapshotted, so its split is immutable. A July-cycle
  // edit that overlaps June on the calendar must NOT be blocked by it.
  const frozenPaid: PaidBill = {
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    paid_snapshot: '[{"member_id":"a","name":"A","days":30,"amount":90}]',
  };
  assert.equal(presenceHitsLock(edit, [frozenPaid]), false);
});

test('allows an edit that overlaps no settled bill at all', () => {
  const farPaid: PaidBill = {
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    paid_snapshot: null,
  };
  assert.equal(presenceHitsLock(edit, [farPaid]), false);
});

test('cross-cycle: a snapshotted June bill never blocks a July edit, even mixed with a distant unfrozen bill', () => {
  const frozenJune: PaidBill = {
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    paid_snapshot: '[]', // frozen → harmless to overlap
  };
  const unfrozenJanuary: PaidBill = {
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    paid_snapshot: null, // would lock, but the edit doesn't reach January
  };
  assert.equal(presenceHitsLock(edit, [frozenJune, unfrozenJanuary]), false);
});

test('an empty edit (clearing all days) hits nothing', () => {
  const unfrozenPaid: PaidBill = {
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    paid_snapshot: null,
  };
  assert.equal(presenceHitsLock([], [unfrozenPaid]), false);
});
