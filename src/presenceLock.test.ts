// Tests for the cross-cycle presence-lock fix (calendar over-block).
//
// Run with Node's built-in test runner + TypeScript type-stripping:
//   node --experimental-strip-types --test src/presenceLock.test.ts
//
// presenceLock.ts imports only `import type` + isInPeriod from calc.ts (no React,
// no JSX), so it loads standalone here. The Worker-side counterpart
// (presenceHitsLock — the actual save-time guard) is covered in
// worker/freeze.test.ts; this file covers the FRONTEND calendar lock and proves
// the two layers now agree.

import test from 'node:test';
import assert from 'node:assert/strict';

import { billFreezesPresence, isPresenceDayLocked } from './presenceLock.ts';
import { calculate, NO_ROUNDING } from './calc.ts';
import type { Bill, Member, PaidSnapshotEntry } from './types.ts';

function bill(
  partial: Partial<Bill> & { bill_id: string; period_start: string; period_end: string }
): Bill {
  return {
    cycle_id: 'cycle-default',
    utility_label: 'Electricity',
    amount: 100,
    status: 'draft',
    paid_snapshot: null,
    ...partial,
  };
}

function member(
  partial: Partial<Member> & { member_id: string; name: string }
): Member {
  return { active: true, days_confirmed: false, presence: [], ...partial };
}

// Cycle 1 electricity: PAID and snapshotted (the normal settled case), covering
// up to 1 May. Cycle 2 water: a new DRAFT bill starting 29 Apr — overlapping.
const snapshot: PaidSnapshotEntry[] = [{ member_id: 'alex', name: 'Alex', days: 31, amount: 100 }];
const paidElectricity = bill({
  bill_id: 'elec',
  cycle_id: 'cycle-1',
  status: 'paid',
  paid_snapshot: snapshot,
  period_start: '2026-04-01',
  period_end: '2026-05-01',
});
const draftWater = bill({
  bill_id: 'water',
  cycle_id: 'cycle-2',
  utility_label: 'Water',
  amount: 60,
  period_start: '2026-04-29',
  period_end: '2026-05-15',
});

test('(a) a day in a snapshotted paid bill is NOT locked — a new overlapping bill can use it', () => {
  const bills = [paidElectricity, draftWater];
  // The disputed overlap window 29 Apr–1 May must be selectable for the water bill.
  for (const key of ['2026-04-29', '2026-04-30', '2026-05-01']) {
    assert.equal(
      isPresenceDayLocked(bills, key),
      false,
      `${key} must be editable (electricity is frozen by its snapshot)`
    );
  }
  // And a non-overlapping water day is plainly editable too.
  assert.equal(isPresenceDayLocked(bills, '2026-05-10'), false);
});

test('(b) a day in a snapshot-LESS paid bill stays locked (protection intact)', () => {
  // A legacy/edge paid bill with no snapshot still recalculates live, so editing
  // presence over it would change a settled split — it must stay locked.
  const unfrozenPaid = bill({
    bill_id: 'elec-legacy',
    status: 'paid',
    paid_snapshot: null,
    period_start: '2026-04-01',
    period_end: '2026-05-01',
  });
  assert.equal(billFreezesPresence(unfrozenPaid), true);
  assert.equal(isPresenceDayLocked([unfrozenPaid, draftWater], '2026-04-30'), true);
});

test('(b2) draft and confirmed bills never lock presence (mirrors the Worker)', () => {
  assert.equal(billFreezesPresence(draftWater), false);
  const confirmed = bill({ bill_id: 'c', status: 'confirmed', period_start: '2026-04-01', period_end: '2026-05-01' });
  assert.equal(billFreezesPresence(confirmed), false);
  assert.equal(isPresenceDayLocked([confirmed], '2026-04-15'), false);
});

test('(c) the new water bill computes off the frozen presence over the overlap', () => {
  // Alex's frozen presence (the days the settled electricity bill already froze)
  // runs 1 Apr–5 May, so it partially overlaps the water period (29 Apr–15 May).
  // The water bill READS that frozen presence to compute its own split — it never
  // re-edits it.
  const alex = member({
    member_id: 'alex',
    name: 'Alex',
    presence: [{ start: '2026-04-01', end: '2026-05-05' }],
  });
  const bob = member({ member_id: 'bob', name: 'Bob' }); // no presence → present whole water period

  const calc = calculate(draftWater, [alex, bob], NO_ROUNDING);
  const alexShare = calc.shares.find((s) => s.member.member_id === 'alex');
  const bobShare = calc.shares.find((s) => s.member.member_id === 'bob');
  assert.ok(alexShare && bobShare);

  // Water period is 29 Apr–15 May (17 days). Alex's frozen presence overlaps it on
  // 29 Apr–5 May = 7 days; Bob (default-present) counts all 17. Total 24 shares.
  assert.equal(alexShare.days, 7);
  assert.equal(bobShare.days, 17);
  assert.equal(calc.totalDays, 24);
  // Split computed straight off the frozen presence: 7/24·$60 and 17/24·$60.
  assert.equal(alexShare.amount, 17.5);
  assert.equal(bobShare.amount, 42.5);
  assert.equal(alexShare.amount + bobShare.amount, 60);

  // The settled electricity snapshot is untouched by any of this.
  assert.deepEqual(paidElectricity.paid_snapshot, snapshot);
});
