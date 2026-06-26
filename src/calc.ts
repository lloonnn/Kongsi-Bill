import type { Bill, Member, RoundingConfig } from './types';

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
  const start = new Date(bill.periodStart + 'T00:00:00').getTime();
  const end = new Date(bill.periodEnd + 'T00:00:00').getTime();
  return Math.round((end - start) / 86400000) + 1;
}

/**
 * Home days a member counts for a bill: everyone is home by default, so it's
 * the period length minus the away days that fall inside the period.
 */
export function homeDaysInPeriod(member: Member, bill: Bill): number {
  const away = member.awayDays.filter(
    (k) => k >= bill.periodStart && k <= bill.periodEnd
  ).length;
  return Math.max(0, periodLength(bill) - away);
}

/** True if an ISO date key falls inside the bill period (inclusive). */
export function isInPeriod(key: string, bill: Bill): boolean {
  return key >= bill.periodStart && key <= bill.periodEnd;
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
  const excluded = new Set(bill.awayMemberIds ?? []);
  // Active members, minus anyone confirmed away for the whole period.
  const participants = members.filter((m) => m.active && !excluded.has(m.id));
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
  if (totalDays === 0) {
    return {
      status: 'warn',
      message: 'Everyone is marked away for the whole period',
      detail:
        'No one counts as home, so there’s no split to make. Check the away days, or confirm this bill applies to no one.',
    };
  }

  // Actionable flag: a member marked away for the entire period (0 home days).
  const empty = shares.find((s) => s.days === 0);
  if (empty) {
    return {
      status: 'warn',
      message: `${empty.member.name} was away the whole period — 0 days home`,
      detail: `They can’t take a share of this bill. Confirm ${empty.member.name} was away (they’ll be left out and pay nothing), or fix their days first.`,
    };
  }

  // With rounding off the cents always sum exactly to the bill amount.
  if (!rounding.enabled) {
    return {
      status: 'ok',
      message: `Reconciled — shares add up to ${money(bill.amount)}`,
    };
  }

  // With rounding on, a small remainder is expected and stated plainly.
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

export const UTILITY_META: Record<Bill['utility'], { label: string; icon: string }> = {
  electricity: { label: 'Electricity', icon: '⚡' },
  water: { label: 'Water', icon: '💧' },
  gas: { label: 'Gas', icon: '🔥' },
  internet: { label: 'Internet', icon: '📶' },
  other: { label: 'Other', icon: '🧾' },
};

/** Display name for a bill — the custom name for "other", else the preset. */
export function billLabel(bill: Pick<Bill, 'utility' | 'customLabel'>): string {
  return bill.customLabel?.trim() || UTILITY_META[bill.utility].label;
}

export function billIcon(bill: Pick<Bill, 'utility'>): string {
  return UTILITY_META[bill.utility].icon;
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
    const key = b.periodEnd.slice(0, 7);
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

export function formatPeriod(bill: Bill): string {
  const fmt = (k: string) =>
    new Date(k + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  const start = new Date(bill.periodStart + 'T00:00:00');
  const end = new Date(bill.periodEnd + 'T00:00:00');
  const days =
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const year = end.getFullYear();
  return `${fmt(bill.periodStart)} – ${fmt(bill.periodEnd)} ${year} · ${days} days`;
}
