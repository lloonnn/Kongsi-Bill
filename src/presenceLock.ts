// Presence-edit lock for the calendar — the FRONTEND mirror of the Worker's
// presenceHitsLock (worker/index.ts). Kept in its own plain-TS module (no JSX, no
// React) so it loads in the node test runner; Calendar.tsx imports it.
//
// THE RULE (must match the Worker exactly, or the UI over- or under-blocks
// relative to what the server actually enforces):
//
//   A bill freezes presence on its days iff its split is STILL MUTABLE — i.e. it
//   is settled (status 'paid') but has NO paid_snapshot. A paid bill WITH a
//   snapshot (migration 0004) renders that frozen split and never recalculates,
//   so editing presence over its days cannot change it; locking those days would
//   only wrongly stop a DIFFERENT cycle's overlapping bill from using them
//   (cycles may share dates — migration 0005). 'draft' and 'confirmed' bills are
//   never settled, so they never freeze presence.
//
// Money-protection stays intact: a settled split is immutable either way —
// frozen by its snapshot, or, for a legacy snapshot-less paid bill, frozen by
// this date lock. The lock is made precise, never removed.

import type { Bill } from './types';

// `import type` only (erased at runtime) so this module loads standalone in the
// node test runner. The period check is the same inclusive YYYY-MM-DD comparison
// as calc.ts isInPeriod — inlined to keep this a zero-runtime-dependency predicate.

/** True iff this bill freezes presence on its days (settled + still mutable). */
export function billFreezesPresence(bill: Bill): boolean {
  return bill.status === 'paid' && bill.paid_snapshot == null;
}

/**
 * Whether a given day-key is locked for presence editing by any still-mutable
 * settled bill. A day inside a snapshotted paid bill is NOT locked here (its
 * split is already frozen), so a new overlapping bill can use it.
 */
export function isPresenceDayLocked(bills: Bill[], key: string): boolean {
  return bills.some(
    (b) => billFreezesPresence(b) && key >= b.period_start && key <= b.period_end
  );
}
