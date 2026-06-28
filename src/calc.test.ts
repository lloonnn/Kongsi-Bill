// Tests for the presence-based member-inclusion rule in calculate().
//
// Run with Node's built-in test runner + TypeScript type-stripping (no extra
// deps): `node --experimental-strip-types --test src/calc.test.ts`.
//
// calc.ts only `import type`s from ./types, so type-stripping erases that
// import — the module has no runtime imports and loads standalone here.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculate,
  calculateCombined,
  groupBillsByCycle,
  NO_ROUNDING,
  roundToIncrement,
} from './calc.ts';
import type { Bill, Cycle, Member, PaidSnapshotEntry } from './types.ts';

function member(
  partial: Partial<Member> & { member_id: string; name: string }
): Member {
  return { active: true, days_confirmed: false, presence: [], ...partial };
}

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

function cycle(partial: Partial<Cycle> & { cycle_id: string }): Cycle {
  return {
    display_name: partial.cycle_id,
    status: 'open',
    created_at: '2026-01-01',
    ...partial,
  };
}

const shareFor = (calc: ReturnType<typeof calculate>, id: string) =>
  calc.shares.find((s) => s.member.member_id === id);

// Timeline: Dana lived here Jan–Mar 2026, then was soft-removed (active=false)
// in April. Alex is a current, active housemate with no recorded presence.
const alex = member({ member_id: 'alex', name: 'Alex' }); // active, empty presence
const danaWithPresence = member({
  member_id: 'dana',
  name: 'Dana',
  active: false, // soft-removed
  presence: [{ start: '2026-01-01', end: '2026-03-31' }],
});
const danaNoPresence = member({
  member_id: 'dana',
  name: 'Dana',
  active: false, // soft-removed, never recorded any presence
});

const marchBill = bill({
  bill_id: 'mar',
  period_start: '2026-03-01',
  period_end: '2026-03-31',
}); // open (draft), falls inside Dana's tenancy
const mayBill = bill({
  bill_id: 'may',
  period_start: '2026-05-01',
  period_end: '2026-05-31',
}); // entirely after Dana was removed

test('(a) soft-removed member present during an open pre-removal bill keeps their share', () => {
  const calc = calculate(marchBill, [alex, danaWithPresence], NO_ROUNDING);
  const dana = shareFor(calc, 'dana');
  assert.ok(dana, 'soft-removed Dana should be included — she was present in March');
  assert.equal(dana.days, 31); // present all 31 days of March
  assert.equal(calc.totalDays, 62); // Alex 31 (default-present) + Dana 31
  assert.equal(dana.amount, 50); // 31/62 × $100
});

test('(b) soft-removed member is excluded from a bill entirely after their removal', () => {
  const calc = calculate(mayBill, [alex, danaWithPresence], NO_ROUNDING);
  assert.equal(shareFor(calc, 'dana'), undefined); // Jan–Mar presence never reaches May
  const alexShare = shareFor(calc, 'alex');
  assert.ok(alexShare);
  assert.equal(alexShare.days, 31);
  assert.equal(alexShare.amount, 100); // sole participant
});

test('(c) soft-removed member with empty presence counts as present for a pre-removal open bill', () => {
  const calc = calculate(marchBill, [alex, danaNoPresence], NO_ROUNDING);
  const dana = shareFor(calc, 'dana');
  assert.ok(dana, 'default-to-present: empty presence means present the whole period');
  assert.equal(dana.days, 31); // full period length
  assert.equal(dana.amount, 50);
});

test('(d) a paid bill renders its frozen paid_snapshot, unaffected by the inclusion change', () => {
  // Mirrors BillOverview.tsx entriesFor(): paid + snapshot present => use the
  // snapshot verbatim; otherwise live-recalculate. The inclusion change lives
  // only in calculate(), so the snapshot branch must be untouched.
  const snapshot: PaidSnapshotEntry[] = [
    { member_id: 'alex', name: 'Alex', days: 31, amount: 50 },
    { member_id: 'dana', name: 'Dana', days: 31, amount: 50 },
  ];
  const paidBill: Bill = { ...mayBill, status: 'paid', paid_snapshot: snapshot };

  const entriesFor = (b: Bill): PaidSnapshotEntry[] => {
    if (b.status === 'paid' && b.paid_snapshot != null) return b.paid_snapshot;
    return calculate(b, [alex, danaWithPresence], NO_ROUNDING).shares.map((s) => ({
      member_id: s.member.member_id,
      name: s.member.name,
      days: s.days,
      amount: s.amount,
    }));
  };

  const entries = entriesFor(paidBill);
  assert.deepEqual(entries, snapshot); // frozen split returned verbatim
  assert.ok(
    entries.some((e) => e.member_id === 'dana'),
    'Dana stays in the paid split even though a live recalc would now drop her'
  );

  // Prove the paths genuinely diverge: a LIVE recalc of the same May period
  // excludes Dana — so it is the snapshot, not calculate(), that kept her.
  const live = calculate(paidBill, [alex, danaWithPresence], NO_ROUNDING);
  assert.equal(shareFor(live, 'dana'), undefined);
});

test('(a-combined) calculateCombined includes a soft-removed member present during a pre-removal open bill', () => {
  // Same scenario as (a), but through the combined-bills view.
  const calc = calculateCombined([marchBill], [alex, danaWithPresence], NO_ROUNDING);
  const dana = calc.shares.find((s) => s.member.member_id === 'dana');
  assert.ok(dana, 'soft-removed Dana should be included — she was present in March');
  assert.equal(dana.components[0].days, 31); // present all 31 days of March
  assert.equal(dana.amount, 50); // 31/62 × $100
});

// ---------------------------------------------------------------------------
// Per-cycle grouping (migration 0005). Calculate must act on ONE cycle's bills.
// Two cycles with OVERLAPPING dates must not collide: each is computed over only
// its own bills, so feeding groupBillsByCycle's output into the unchanged calc
// keeps them independent.
// ---------------------------------------------------------------------------

const juneCycle = cycle({ cycle_id: 'cycle-jun', display_name: 'June 2026' });
const julyCycle = cycle({ cycle_id: 'cycle-jul', display_name: 'July 2026' });

// June and July deliberately share dates (25–30 June) to prove cycles isolate.
const juneElec = bill({
  bill_id: 'jun-elec',
  cycle_id: 'cycle-jun',
  amount: 90,
  period_start: '2026-06-01',
  period_end: '2026-06-30',
});
const juneWater = bill({
  bill_id: 'jun-water',
  cycle_id: 'cycle-jun',
  amount: 30,
  period_start: '2026-06-01',
  period_end: '2026-06-30',
});
const julyElec = bill({
  bill_id: 'jul-elec',
  cycle_id: 'cycle-jul',
  amount: 200,
  period_start: '2026-06-25', // overlaps June's cycle on the calendar
  period_end: '2026-07-25',
});

test('(e) groupBillsByCycle buckets bills by cycle_id and never mixes cycles', () => {
  const groups = groupBillsByCycle(
    [juneElec, julyElec, juneWater],
    [juneCycle, julyCycle]
  );
  assert.equal(groups.length, 2);

  const june = groups.find((g) => g.cycle.cycle_id === 'cycle-jun');
  const july = groups.find((g) => g.cycle.cycle_id === 'cycle-jul');
  assert.ok(june && july);
  assert.deepEqual(
    june.bills.map((b) => b.bill_id).sort(),
    ['jun-elec', 'jun-water']
  );
  assert.equal(june.total, 120); // 90 + 30, July's $200 not pulled in
  assert.deepEqual(july.bills.map((b) => b.bill_id), ['jul-elec']);
  assert.equal(july.total, 200);
});

test('(f) calculate over one cycle ignores another cycle’s bills entirely', () => {
  // Combine ONLY the June cycle. The overlapping July bill must not appear.
  const [june] = groupBillsByCycle([juneElec, juneWater, julyElec], [juneCycle]);
  const calc = calculateCombined(june.bills, [alex], NO_ROUNDING);
  assert.equal(calc.grandTotal, 120); // 90 + 30 — July's $200 excluded
  assert.equal(calc.bills.length, 2);
  assert.ok(!calc.bills.some((b) => b.bill_id === 'jul-elec'));
});

test('(g) overlapping dates across cycles do not collide — each cycle computes independently', () => {
  // Same single member, same overlapping calendar window, two cycles. The July
  // result must be unaffected by June's bills and vice versa.
  const groups = groupBillsByCycle(
    [juneElec, juneWater, julyElec],
    [juneCycle, julyCycle]
  );
  const june = groups.find((g) => g.cycle.cycle_id === 'cycle-jun')!;
  const july = groups.find((g) => g.cycle.cycle_id === 'cycle-jul')!;

  const juneCalc = calculateCombined(june.bills, [alex], NO_ROUNDING);
  const julyCalc = calculateCombined(july.bills, [alex], NO_ROUNDING);

  // Sole participant pays each cycle's whole total — independently.
  assert.equal(juneCalc.shares[0].amount, 120);
  assert.equal(julyCalc.shares[0].amount, 200);
  // The overlap on 25–30 June never double-counts or cross-contaminates.
  assert.equal(juneCalc.grandTotal + julyCalc.grandTotal, 320);
});

// ---------------------------------------------------------------------------
// roundToIncrement — round final per-person totals to the nearest 0.05.
//   up   = ceiling to 0.05
//   down = floor to 0.05
//   already on a 5-cent mark → up = down = unchanged (must hold EXACTLY despite
//   float error, e.g. 0.15 / 0.05 === 2.9999999999999996).
// ---------------------------------------------------------------------------

const up = (v: number) => roundToIncrement(v, 0.05, 'up');
const down = (v: number) => roundToIncrement(v, 0.05, 'down');

test('(r1) off-mark values round to the 5-cent boundary in each direction', () => {
  assert.equal(up(53.44), 53.45);
  assert.equal(down(53.44), 53.4);
  assert.equal(up(53.49), 53.5);
  assert.equal(down(53.49), 53.45);
  assert.equal(up(43.49), 43.5);
  assert.equal(down(43.49), 43.45);
});

test('(r2) the spec’s on-mark values are unchanged in both directions', () => {
  assert.equal(up(53.45), 53.45);
  assert.equal(down(53.45), 53.45);
  assert.equal(up(53.4), 53.4);
  assert.equal(down(53.4), 53.4);
});

test('(r3) float-boundary on-mark values are NOT bumped (regression: 0.15/1.15/2.05 down)', () => {
  // Each of these divided by 0.05 is just under an integer in float, so the old
  // value/increment + Math.floor bumped them down a step. They must stay put.
  for (const v of [0.05, 0.1, 0.15, 0.2, 0.45, 1.15, 2.05, 3.35, 9.95]) {
    assert.equal(down(v), v, `down(${v}) must be unchanged`);
    assert.equal(up(v), v, `up(${v}) must be unchanged`);
  }
});

test('(r4) every 5-cent mark from 0.00 to 10.00 is a fixed point of both directions', () => {
  // Exhaustive on-mark sweep — proves the "unchanged" rule holds across the range,
  // not just for the hand-picked values above.
  for (let cents = 0; cents <= 1000; cents += 5) {
    const v = cents / 100;
    assert.equal(down(v), v, `down(${v})`);
    assert.equal(up(v), v, `up(${v})`);
  }
});
