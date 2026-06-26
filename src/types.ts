// Domain types for the Kongsi Bill prototype.
// All data is in-memory mock data — no backend, no persistence.

export type AvatarTone = 'accent' | 'alt2' | 'alt3';

export interface Member {
  id: string;
  name: string;
  tone: AvatarTone;
  /** Soft-removed members stay in records but no longer record presence. */
  active: boolean;
  /**
   * ISO date keys (YYYY-MM-DD) the member marked as AWAY.
   * Everyone is counted home by default for any bill period — a member only
   * records the days they were NOT around. Home days for a bill = period
   * length minus the away days that fall inside the period.
   */
  awayDays: string[];
}

export type Utility = 'electricity' | 'water' | 'gas' | 'internet' | 'other';

// A bill is "open" (housemates can still mark days) until the admin locks it
// when everyone has marked their dates. No time limit — the admin decides.
export type BillStatus = 'open' | 'locked';

export interface Bill {
  id: string;
  utility: Utility;
  /** For utility === 'other': the custom name the admin typed. */
  customLabel?: string;
  amount: number;
  /** Inclusive ISO date keys bounding the bill period. */
  periodStart: string;
  periodEnd: string;
  status: BillStatus;
  /** Set once locked, so history can show when it was finalized. */
  lockedOn?: string;
  /**
   * Members confirmed away for the WHOLE period — excluded from this bill
   * (they pay nothing and don't count toward the split denominator).
   */
  awayMemberIds?: string[];
  /**
   * Members who have confirmed their days are correct for this (open) bill.
   * Lets the admin see who's reviewed vs. who's still counted home by default.
   * Cleared for a member when they change their days, and on re-open.
   */
  confirmedMemberIds?: string[];
}

export interface RoundingConfig {
  enabled: boolean;
  mode: 'down' | 'up';
  /** Round to nearest increment (dollars), e.g. 0.05. */
  increment: number;
}

export interface House {
  id: string;
  name: string;
  roomId: string;
  memberCode: string;
  adminCode: string;
  /** Which member record is the admin/bill-payer — they mark days too. */
  adminMemberId: string;
  members: Member[];
  bills: Bill[];
}
