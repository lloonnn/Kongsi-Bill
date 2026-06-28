// Where a cycle is shown in the admin bills views — DISPLAY/NAVIGATION ONLY.
// This never mutates anything; it just reads status + bills to decide placement,
// so a cycle moves between the main screen and History automatically as its state
// changes. Kept as a plain `import type`-only module (no React/JSX) so it loads
// in the node test runner, like presenceLock.ts.
//
// THE RULE:
//   active (main bills screen)  ⇢ status !== 'finalized'  OR  any bill is a draft
//   finalized (History view)    ⇢ status === 'finalized'  AND no draft bills
//
// Why "or any draft": reopening a settled bill flips just THAT bill back to draft
// (it does not change cycle.status — that stays 'finalized'). Treating a draft
// bill as "active" makes a reopened cycle reappear on the main screen
// automatically, and re-finalizing it (all bills paid via Calculate) returns it
// to History — exactly the handoff's "status NOT finalized … plus any reopened",
// with zero change to what reopen does to the data/freeze.

import type { Bill, Cycle } from './types';

/** True when the cycle belongs on the main bills screen (open, or has open work). */
export function isCycleActive(cycle: Cycle, bills: Bill[]): boolean {
  return cycle.status !== 'finalized' || bills.some((b) => b.status === 'draft');
}
