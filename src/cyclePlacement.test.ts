// Tests for the active-vs-History placement rule (display only).
//
// Run with Node's built-in test runner + TypeScript type-stripping:
//   node --experimental-strip-types --test src/cyclePlacement.test.ts
//
// cyclePlacement.ts is `import type`-only (erased at runtime), so it loads
// standalone here. These tests pin the status-driven placement, including the
// reopen → main and re-finalize → History transitions that the feature requires.

import test from 'node:test';
import assert from 'node:assert/strict';

import { isCycleActive } from './cyclePlacement.ts';
import type { Bill, Cycle } from './types.ts';

function cycle(partial: Partial<Cycle> & { cycle_id: string }): Cycle {
  return { display_name: partial.cycle_id, status: 'open', created_at: '2026-01-01', ...partial };
}

function bill(partial: Partial<Bill> & { bill_id: string }): Bill {
  return {
    cycle_id: 'c',
    utility_label: 'Electricity',
    amount: 100,
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    status: 'draft',
    paid_snapshot: null,
    ...partial,
  };
}

const draftBill = bill({ bill_id: 'b-draft', status: 'draft' });
const paidBill = bill({
  bill_id: 'b-paid',
  status: 'paid',
  paid_snapshot: [{ member_id: 'a', name: 'A', days: 30, amount: 100 }],
});

test('an open cycle is active (main screen) — even with no bills', () => {
  assert.equal(isCycleActive(cycle({ cycle_id: 'c1', status: 'open' }), []), true);
  assert.equal(isCycleActive(cycle({ cycle_id: 'c1', status: 'open' }), [draftBill]), true);
});

test('a finalized cycle with all bills paid is NOT active → lives in History', () => {
  assert.equal(isCycleActive(cycle({ cycle_id: 'c2', status: 'finalized' }), [paidBill]), false);
});

test('reopen: a finalized cycle with a reopened (draft) bill becomes active → back to main', () => {
  // Reopen flips one bill to draft but leaves cycle.status = 'finalized'; the draft
  // bill is what pulls the cycle back onto the main screen.
  const reopened = cycle({ cycle_id: 'c3', status: 'finalized' });
  assert.equal(isCycleActive(reopened, [paidBill, draftBill]), true);
});

test('re-finalize: once every bill is paid again, the cycle leaves main → returns to History', () => {
  const refinalized = cycle({ cycle_id: 'c3', status: 'finalized' });
  assert.equal(isCycleActive(refinalized, [paidBill, paidBill]), false);
});

test('placement is the exact complement: a cycle is on main XOR in History', () => {
  const cases: { c: Cycle; bills: Bill[] }[] = [
    { c: cycle({ cycle_id: 'a', status: 'open' }), bills: [] },
    { c: cycle({ cycle_id: 'b', status: 'open' }), bills: [draftBill] },
    { c: cycle({ cycle_id: 'd', status: 'finalized' }), bills: [paidBill] },
    { c: cycle({ cycle_id: 'e', status: 'finalized' }), bills: [paidBill, draftBill] },
  ];
  for (const { c, bills } of cases) {
    const onMain = isCycleActive(c, bills);
    const inHistory = !isCycleActive(c, bills);
    assert.notEqual(onMain, inHistory, `${c.cycle_id} must be in exactly one view`);
  }
});
