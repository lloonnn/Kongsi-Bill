import type { Bill, Cycle, DateRange, Member, RoundingConfig } from './types';

// NOTE: this file keeps the prototype's split + rounding algorithm exactly —
// day-weighting, largest-remainder cent allocation, reconciliation messages.
// Only the *data shape* it reads changed: snake_case bill fields, and presence
// is now PRESENT ranges instead of an away-day list (see homeDaysInPeriod).
// The Worker does no maths; all of this stays in the browser.

/** Default rounding policy: off (full-precision cents). */
export const NO_ROUNDING: RoundingConfig = {
  enabled: false,
  mode: 'down',
  increment: 0.05,
};

/** Format a number as a 2-decimal dollar string, e.g. 46.27 -> "$46.27". */
export function money(n: number): string {
  return '$' + n.toFixed(2);
}

/** Inclusive number of calendar days in a bill's period. */
export function periodLength(bill: Bill): number {
  const start = new Date(bill.period_start + 'T00:00:00').getTime();
  const end = new Date(bill.period_end + 'T00:00:00').getTime();
  return Math.round((end - start) / 86400000) + 1;
}

/** Inclusive day count of [start, end] intersected with [lo, hi]; 0 if disjoint. */
function overlapDays(start: string, end: string, lo: string, hi: string): number {
  const s = start > lo ? start : lo;
  const e = end < hi ? end : hi;
  if (s > e) return 0;
  const ms = new Date(e + 'T00:00:00').getTime() - new Date(s + 'T00:00:00').getTime();
  return Math.round(ms / 86400000) + 1;
}

/**
 * Merge overlapping and adjacent presence ranges into a minimal, sorted,
 * non-overlapping set so no day is counted twice (README §3 step 2). Ranges are
 * already merged in the Worker on save, but the audit calculation merges again
 * here so the in-browser maths is correct on its own, even if it is ever handed
 * unmerged input. Pure — does not mutate the caller's array.
 */
function mergeRanges(ranges: DateRange[]): DateRange[] {
  if (ranges.length <= 1) return ranges.slice();
  const sorted = [...ranges].sort((a, b) =>
    a.start < b.start ? -1 : a.start > b.start ? 1 : 0
  );
  const out: DateRange[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    // Overlapping or touching (cur starts on or before the day after last ends).
    if (cur.start <= nextDay(last.end)) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/**
 * Home (present) days a member counts for a bill.
 *
 * Presence is stored as PRESENT ranges. A member with recorded ranges counts
 * the days of those ranges that fall inside the bill period; ranges are merged
 * first (see mergeRanges) so overlaps never double-count. A member with NO
 * recorded presence at all is treated as "present the whole period" — the
 * blueprint's default-to-present rule (§6.6) — so an un-marked housemate still
 * gets a fair share rather than silently dropping to zero.
 */
export function homeDaysInPeriod(member: Member, bill: Bill): number {
  if (member.presence.length === 0) return periodLength(bill);
  let days = 0;
  for (const r of mergeRanges(member.presence)) {
    days += overlapDays(r.start, r.end, bill.period_start, bill.period_end);
  }
  return Math.min(days, periodLength(bill));
}

/** True if an ISO date key falls inside the bill period (inclusive). */
export function isInPeriod(key: string, bill: Bill): boolean {
  return key >= bill.period_start && key <= bill.period_end;
}

/**
 * Whether a member takes a share of a bill: were they PRESENT for at least one
 * day of the bill's period? This is presence-based, NOT the current `active`
 * flag — so a soft-removed member still shares bills from while they lived
 * here, and the live `active` flag never retroactively rewrites an old split.
 *
 * Inclusion is exactly "presence overlaps [period_start, period_end]", reusing
 * homeDaysInPeriod so the default-to-present rule is honoured: a member with NO
 * recorded presence counts as present the whole period (homeDaysInPeriod > 0),
 * so an un-marked housemate on a bill from before they were removed still keeps
 * a share rather than silently dropping out.
 */
export function wasPresentInPeriod(member: Member, bill: Bill): boolean {
  return homeDaysInPeriod(member, bill) > 0;
}

export interface PersonShare {
  member: Member;
  days: number;
  /** Unrounded exact share. */
  exact: number;
  /** Displayed amount after the active rounding policy. */
  amount: number;
  /** The literal working, e.g. "31/67 days × $100.00". */
  working: string;
}

export interface Reconciliation {
  status: 'ok' | 'warn';
  message: string;
  detail?: string;
}

export interface Calculation {
  shares: PersonShare[];
  totalDays: number;
  /** Sum of displayed amounts. */
  collected: number;
  /** bill.amount - collected. Positive = shortfall, negative = surplus. */
  remainder: number;
  reconciliation: Reconciliation;
}

function roundCentsLargestRemainder(
  exacts: number[],
  total: number
): number[] {
  // Floor each to whole cents, then hand out the leftover cents to the
  // largest fractional parts so the result sums to `total` exactly.
  const targetCents = Math.round(total * 100);
  const floors = exacts.map((e) => Math.floor(e * 100));
  const used = floors.reduce((a, b) => a + b, 0);
  let leftover = targetCents - used;

  const order = exacts
    .map((e, i) => ({ i, frac: e * 100 - Math.floor(e * 100) }))
    .sort((a, b) => b.frac - a.frac);

  const cents = [...floors];
  let k = 0;
  while (leftover > 0 && order.length > 0) {
    cents[order[k % order.length].i] += 1;
    leftover -= 1;
    k += 1;
  }
  return cents.map((c) => c / 100);
}

function roundToIncrement(value: number, increment: number, mode: 'down' | 'up'): number {
  const steps = value / increment;
  const r = mode === 'down' ? Math.floor(steps) : Math.ceil(steps);
  return Math.round(r * increment * 100) / 100;
}

/**
 * Day-weighted split: each active member pays (their days / total day-shares)
 * of the bill. Members carry their own day-count — total is the sum of every
 * member's days, not the number of calendar days.
 */
export function calculate(
  bill: Bill,
  members: Member[],
  rounding: RoundingConfig
): Calculation {
  // Include everyone PRESENT during this bill's period — not just currently
  // `active` members. A soft-removed housemate keeps their share of bills from
  // while they lived here; the current active flag never rewrites an old split.
  const participants = members.filter((m) => wasPresentInPeriod(m, bill));
  const dayCounts = participants.map((m) => homeDaysInPeriod(m, bill));
  const totalDays = dayCounts.reduce((a, b) => a + b, 0);

  const exacts = participants.map((_, i) =>
    totalDays === 0 ? 0 : (dayCounts[i] / totalDays) * bill.amount
  );

  let amounts: number[];
  if (totalDays === 0) {
    amounts = participants.map(() => 0);
  } else if (rounding.enabled) {
    amounts = exacts.map((e) => roundToIncrement(e, rounding.increment, rounding.mode));
  } else {
    amounts = roundCentsLargestRemainder(exacts, bill.amount);
  }

  const shares: PersonShare[] = participants.map((m, i) => ({
    member: m,
    days: dayCounts[i],
    exact: exacts[i],
    amount: amounts[i],
    working: `${dayCounts[i]}/${totalDays} days × ${money(bill.amount)}`,
  }));

  const collected = Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100;
  const remainder = Math.round((bill.amount - collected) * 100) / 100;

  const reconciliation = reconcile(bill, shares, totalDays, remainder, rounding);

  return { shares, totalDays, collected, remainder, reconciliation };
}

function reconcile(
  bill: Bill,
  shares: PersonShare[],
  totalDays: number,
  remainder: number,
  rounding: RoundingConfig
): Reconciliation {
  // No participants at all — empty house, or a PIC who isn't yet a housemate.
  if (shares.length === 0) {
    return {
      status: 'warn',
      message: 'No housemates yet',
      detail:
        'Add the people who live here (including yourself, if you do) before splitting this bill.',
    };
  }

  if (totalDays === 0) {
    return {
      status: 'warn',
      message: 'Everyone is marked away for the whole period',
      detail:
        'No one counts as home, so there’s no split to make. Check the presence days, or confirm this bill applies to no one.',
    };
  }

  // Actionable flag: a member present 0 days in the period.
  const empty = shares.find((s) => s.days === 0);
  if (empty) {
    return {
      status: 'warn',
      message: `${empty.member.name} was away the whole period — 0 days home`,
      detail: `They can’t take a share of this bill. Fix their days, or leave them at 0 (they’ll pay nothing).`,
    };
  }

  // Independent tolerance check (blueprint §line 93): the displayed shares must
  // reconcile to the bill amount, not just be assumed to by construction.
  if (!rounding.enabled) {
    // No rounding: the cents must sum to the bill amount within a half-cent.
    if (Math.abs(remainder) > 0.005) {
      return {
        status: 'warn',
        message: `Shares don’t add up — off by ${money(Math.abs(remainder))}`,
        detail: `They should total ${money(bill.amount)} but the parts sum to ${money(
          bill.amount - remainder
        )}. That’s a calculation error — please report it.`,
      };
    }
    return {
      status: 'ok',
      message: `Reconciled — shares add up to ${money(bill.amount)}`,
    };
  }

  // With rounding on, a remainder is expected — but only up to one increment
  // per participant. Anything larger means the rounding itself misbehaved.
  const maxRemainder = rounding.increment * shares.length + 0.005;
  if (Math.abs(remainder) > maxRemainder) {
    return {
      status: 'warn',
      message: `Rounding remainder is larger than expected (${money(Math.abs(remainder))})`,
      detail: `Rounding to ${money(rounding.increment)} should leave at most ${money(
        rounding.increment * shares.length
      )} across ${shares.length} ${shares.length === 1 ? 'person' : 'people'}. Please report it.`,
    };
  }
  return {
    status: 'ok',
    message: `Reconciled — shares add up to ${money(bill.amount - remainder)}`,
    detail: remainderSentence(remainder),
  };
}

/** Plain-consequence language for a rounding remainder (never silent). */
export function remainderSentence(remainder: number): string {
  if (remainder === 0) return 'Rounding leaves no remainder — shares sum exactly to the bill.';
  if (remainder > 0) {
    return `House collects ${money(remainder)} less than the bill — someone covers the small gap.`;
  }
  return `House collects ${money(-remainder)} more than the bill — a small surplus.`;
}

// ---------------------------------------------------------------------------
// Combined split across several bills. Each person's share is computed per bill
// (day-weighted, clipped to that bill's own period) and then SUMMED, and the
// rounding policy is applied to that COMBINED per-person total — NOT per bill.
// Example: electricity $49.53 + water $33.20 → each person's two shares are
// added first ($82.73 of house spend total), then the single combined amount is
// rounded. If the house only pays electricity, only $49.53 is in the combine.
// ---------------------------------------------------------------------------

export interface CombinedComponent {
  bill: Bill;
  days: number;
  /** This person's exact (unrounded) share of this one bill. */
  exact: number;
}

export interface CombinedShare {
  member: Member;
  components: CombinedComponent[];
  /** Sum of the exact per-bill shares. */
  exactTotal: number;
  /** The combined total after the rounding policy — what they actually pay. */
  amount: number;
}

export interface CombinedCalculation {
  bills: Bill[];
  shares: CombinedShare[];
  /** Sum of all bill amounts. */
  grandTotal: number;
  /** Sum of displayed combined amounts. */
  collected: number;
  /** grandTotal - collected. */
  remainder: number;
  reconciliation: Reconciliation;
}

export function calculateCombined(
  bills: Bill[],
  members: Member[],
  rounding: RoundingConfig
): CombinedCalculation {
  // Include everyone PRESENT in at least one of the combined bills — the same
  // presence-based rule as calculate(), not the current `active` flag. Members
  // who missed a given bill's period still get 0 days for it (homeDaysInPeriod).
  const participants = members.filter((m) => bills.some((b) => wasPresentInPeriod(m, b)));

  // Per-bill denominator: sum of every participant's days within that bill.
  const totalDaysByBill = bills.map((b) =>
    participants.reduce((sum, m) => sum + homeDaysInPeriod(m, b), 0)
  );

  const base = participants.map((m) => {
    const components: CombinedComponent[] = bills.map((b, bi) => {
      const days = homeDaysInPeriod(m, b);
      const td = totalDaysByBill[bi];
      const exact = td === 0 ? 0 : (days / td) * b.amount;
      return { bill: b, days, exact };
    });
    const exactTotal = components.reduce((s, c) => s + c.exact, 0);
    return { member: m, components, exactTotal };
  });

  const grandTotal = Math.round(bills.reduce((s, b) => s + b.amount, 0) * 100) / 100;
  const exacts = base.map((s) => s.exactTotal);
  const anyPresent = exacts.some((e) => e > 0);

  let amounts: number[];
  if (participants.length === 0 || grandTotal === 0 || !anyPresent) {
    amounts = base.map(() => 0);
  } else if (rounding.enabled) {
    // Round each person's COMBINED total — the whole point of this view.
    amounts = exacts.map((e) => roundToIncrement(e, rounding.increment, rounding.mode));
  } else {
    amounts = roundCentsLargestRemainder(exacts, grandTotal);
  }

  const shares: CombinedShare[] = base.map((s, i) => ({ ...s, amount: amounts[i] }));
  const collected = Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100;
  const remainder = Math.round((grandTotal - collected) * 100) / 100;

  const reconciliation = reconcileCombined(
    participants.length,
    grandTotal,
    anyPresent,
    remainder,
    rounding
  );

  return { bills, shares, grandTotal, collected, remainder, reconciliation };
}

function reconcileCombined(
  participantCount: number,
  grandTotal: number,
  anyPresent: boolean,
  remainder: number,
  rounding: RoundingConfig
): Reconciliation {
  if (participantCount === 0) {
    return {
      status: 'warn',
      message: 'No housemates yet',
      detail: 'Add the people who live here before splitting these bills.',
    };
  }
  if (grandTotal === 0) {
    return {
      status: 'warn',
      message: 'No bills to combine',
      detail: 'Add at least one bill with an amount.',
    };
  }
  if (!anyPresent) {
    return {
      status: 'warn',
      message: 'Nobody is present in any bill period',
      detail: 'No one counts as home, so there’s no split to make. Check everyone’s days.',
    };
  }
  if (!rounding.enabled) {
    if (Math.abs(remainder) > 0.005) {
      return {
        status: 'warn',
        message: `Combined shares don’t add up — off by ${money(Math.abs(remainder))}`,
        detail: `They should total ${money(grandTotal)} but the parts sum to ${money(
          grandTotal - remainder
        )}. That’s a calculation error — please report it.`,
      };
    }
    return {
      status: 'ok',
      message: `Reconciled — combined shares add up to ${money(grandTotal)}`,
    };
  }
  const maxRemainder = rounding.increment * participantCount + 0.005;
  if (Math.abs(remainder) > maxRemainder) {
    return {
      status: 'warn',
      message: `Rounding remainder is larger than expected (${money(Math.abs(remainder))})`,
      detail: `Rounding to ${money(rounding.increment)} should leave at most ${money(
        rounding.increment * participantCount
      )} across ${participantCount} ${participantCount === 1 ? 'person' : 'people'}. Please report it.`,
    };
  }
  return {
    status: 'ok',
    message: `Reconciled — combined shares add up to ${money(grandTotal - remainder)}`,
    detail: remainderSentence(remainder),
  };
}

// ---------------------------------------------------------------------------
// Utility label presets — a frontend-only convenience for the bill form's
// dropdown and for picking an icon. The DB/API store a single free-text
// `utility_label`; these presets never travel to the API. "Other" lets the
// admin type any label.
// ---------------------------------------------------------------------------

export interface UtilityPreset {
  /** The label that becomes utility_label when chosen (except 'Other'). */
  label: string;
  icon: string;
  /** 'Other' is the free-text escape hatch — its label is typed by the admin. */
  freeText?: boolean;
}

export const UTILITY_PRESETS: UtilityPreset[] = [
  { label: 'Electricity', icon: '⚡' },
  { label: 'Water', icon: '💧' },
  { label: 'Gas', icon: '🔥' },
  { label: 'Internet', icon: '📶' },
  { label: 'Other', icon: '🧾', freeText: true },
];

/** Display name for a bill — just its free-text label. */
export function billLabel(bill: Pick<Bill, 'utility_label'>): string {
  return bill.utility_label;
}

/** Pick an icon by matching the label against the presets (case-insensitive). */
export function billIcon(bill: Pick<Bill, 'utility_label'>): string {
  const match = UTILITY_PRESETS.find(
    (p) => !p.freeText && p.label.toLowerCase() === bill.utility_label.trim().toLowerCase()
  );
  return match ? match.icon : '🧾';
}

export interface MonthGroup {
  key: string; // 'YYYY-MM'
  label: string; // 'June 2026'
  bills: Bill[];
  total: number; // combined amount paid to the landlord that cycle
}

/**
 * Group bills into one combined bill per billing month (by the month each
 * period ends). A house pays the landlord one combined amount per cycle —
 * electricity + water + gas + anything else — so history is organised that way.
 */
export function groupBillsByMonth(bills: Bill[]): MonthGroup[] {
  const map = new Map<string, Bill[]>();
  for (const b of bills) {
    const key = b.period_end.slice(0, 7);
    const list = map.get(key);
    if (list) list.push(b);
    else map.set(key, [b]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, bs]) => ({
      key,
      label: new Date(key + '-01T00:00:00').toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      }),
      bills: bs,
      total: bs.reduce((s, x) => s + x.amount, 0),
    }));
}

export interface CycleGroup {
  cycle: Cycle;
  bills: Bill[];
  /** Combined amount paid to the landlord for this cycle. */
  total: number;
}

/**
 * Group a house's bills by their explicit cycle (migration 0005) — the model
 * that replaces groupBillsByMonth's implicit "by the month the period ends".
 * Calculate then operates on ONE CycleGroup's bills: feed `group.bills` straight
 * into calculate()/calculateCombined() (unchanged — the split maths never sees
 * another cycle's bills). Cycles are returned in the order given; a bill whose
 * cycle_id matches no cycle is dropped (the FK makes this impossible in practice,
 * but the grouping stays defensive rather than inventing an orphan bucket).
 */
export function groupBillsByCycle(bills: Bill[], cycles: Cycle[]): CycleGroup[] {
  const byCycle = new Map<string, Bill[]>();
  for (const b of bills) {
    const list = byCycle.get(b.cycle_id);
    if (list) list.push(b);
    else byCycle.set(b.cycle_id, [b]);
  }
  return cycles.map((cycle) => {
    const cycleBills = byCycle.get(cycle.cycle_id) ?? [];
    return {
      cycle,
      bills: cycleBills,
      total: cycleBills.reduce((s, x) => s + x.amount, 0),
    };
  });
}

export function formatPeriod(bill: Bill): string {
  const fmt = (k: string) =>
    new Date(k + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  const start = new Date(bill.period_start + 'T00:00:00');
  const end = new Date(bill.period_end + 'T00:00:00');
  const days =
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const year = end.getFullYear();
  return `${fmt(bill.period_start)} – ${fmt(bill.period_end)} ${year} · ${days} days`;
}

// ---------------------------------------------------------------------------
// Presence <-> calendar-day helpers (pure). The calendar edits a set of present
// day-keys; presence is stored as ranges. These convert between the two.
// ---------------------------------------------------------------------------

/**
 * Expand present ranges into a Set of YYYY-MM-DD day keys. UTC throughout so the
 * keys line up with the calendar cells in any timezone (a local-time round-trip
 * through toISOString shifts keys a day in UTC+ zones).
 */
export function presentDaysFromRanges(ranges: { start: string; end: string }[]): Set<string> {
  const out = new Set<string>();
  for (const r of ranges) {
    const d = new Date(r.start + 'T00:00:00Z');
    const last = new Date(r.end + 'T00:00:00Z');
    while (d <= last) {
      out.add(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return out;
}

/** Collapse a set of present day-keys into clean, sorted, merged ranges. */
export function rangesFromPresentDays(days: Iterable<string>): { start: string; end: string }[] {
  const sorted = [...new Set(days)].sort();
  const out: { start: string; end: string }[] = [];
  for (const key of sorted) {
    const last = out[out.length - 1];
    if (last && nextDay(last.end) === key) {
      last.end = key;
    } else {
      out.push({ start: key, end: key });
    }
  }
  return out;
}

function nextDay(key: string): string {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
