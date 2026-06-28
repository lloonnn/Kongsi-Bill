// Tests for the presence-based member-inclusion rule in calculate().
//
// Run with Node's built-in test runner + TypeScript type-stripping (no extra
// deps): `node --experimental-strip-types --test src/calc.test.ts`.
//
// calc.ts only `import type`s from ./types, so type-stripping erases that
// import — the module has no runtime imports and loads standalone here.

import test from 'node:test';
import assert from 'node:assert/strict';

import { calculate, calculateCombined, NO_ROUNDING } from './calc.ts';
import type { Bill, Member, PaidSnapshotEntry } from './types.ts';

function member(
  partial: Partial<Member> & { member_id: string; name: string }
): Member {
  return { active: true, days_confirmed: false, presence: [], ...partial };
}

function bill(
  partial: Partial<Bill> & { bill_id: string; period_start: string; period_end: string }
): Bill {
  return {
    utility_label: 'Electricity',
    amount: 100,
    status: 'draft',
    paid_snapshot: null,
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
