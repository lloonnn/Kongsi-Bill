// Domain types for the Kongsi Bill prototype.
// All data is in-memory mock data — no backend, no persistence.

export type AvatarTone = 'accent' | 'alt2' | 'alt3';

export interface Member {
  id: string;
  name: string;
  tone: AvatarTone;
  /** Soft-removed members stay in records but no longer record presence. */
  active: boolean;
  /** ISO date keys (YYYY-MM-DD) the member has marked as "home". */
  presence: string[];
}

export type Utility = 'electricity' | 'water' | 'gas';

export type BillStatus = 'draft' | 'grace' | 'locked';

export interface Bill {
  id: string;
  utility: Utility;
  amount: number;
  /** Inclusive ISO date keys bounding the bill period. */
  periodStart: string;
  periodEnd: string;
  status: BillStatus;
  /** For grace bills: ISO date the 7-day grace window ends. */
  graceEndsOn?: string;
  /** Set once locked, so history can show when it was finalized. */
  lockedOn?: string;
}

export interface RoundingConfig {
  enabled: boolean;
  mode: 'down' | 'up';
  /** Round to nearest increment (dollars), e.g. 0.05. */
  increment: number;
}

export interface ChangeLogEntry {
  id: string;
  at: string; // human-readable timestamp
  who: string;
  text: string;
}

export interface House {
  id: string;
  name: string;
  roomId: string;
  memberCode: string;
  adminCode: string;
  members: Member[];
  bills: Bill[];
  changeLog: ChangeLogEntry[];
}
