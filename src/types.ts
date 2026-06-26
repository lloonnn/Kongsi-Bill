// Domain types for Kongsi Bill.
//
// These mirror the Worker JSON contract (worker/index.ts) and the applied D1
// schema (migrations/0001 + 0002), which are the source of truth. Field names
// are the snake_case *database* names so the frontend and API speak the same
// language with no translation layer:
//   house_id, member_code, display_name, member_id, utility_label,
//   period_start/period_end, bill_id, presence ranges as { start, end }.
//
// Internal-only presentational data (e.g. avatar tone) is NEVER part of these
// shapes — it is derived in the UI and never sent to the API.

/** Avatar colour tone — frontend-only, derived from the member id. */
export type AvatarTone = 'accent' | 'alt2' | 'alt3';

/** A presence range: inclusive YYYY-MM-DD dates the member was PRESENT. */
export interface DateRange {
  start: string;
  end: string;
}

export interface Member {
  member_id: string;
  name: string;
  /** Soft-removed members (active=false) stay attached to past bills. */
  active: boolean;
  /**
   * "My days are correct" readiness flag. The member sets it after reviewing
   * their days; it auto-clears whenever they edit their presence. Lets the
   * admin see who is done before locking the cycle.
   */
  days_confirmed: boolean;
  /**
   * Ranges the member was PRESENT (home), inclusive. This replaces the
   * prototype's `awayDays` (days absent) — opposite semantics and shape, to
   * match the API. A member with NO presence ranges is treated as "present the
   * whole period" by the calculation (blueprint §6.6) until they record days.
   */
  presence: DateRange[];
}

/**
 * Bill lifecycle label: draft → confirmed → paid.
 *   draft     — editable; housemates can still mark their days.
 *   confirmed — locked & announced; the split is final, days can't change.
 *   paid      — settled/closed; the admin has paid the landlord.
 * 'confirmed' and 'paid' both lock editing (the admin can reopen to 'draft').
 */
export type BillStatus = 'draft' | 'confirmed' | 'paid';

export interface Bill {
  bill_id: string;
  /** Single free-text label, e.g. "Electricity", "Water", or anything typed. */
  utility_label: string;
  amount: number;
  /** Inclusive YYYY-MM-DD dates bounding the bill period. */
  period_start: string;
  period_end: string;
  status: BillStatus;
}

export interface RoundingConfig {
  enabled: boolean;
  mode: 'down' | 'up';
  /** Round to nearest increment (dollars), e.g. 0.05. */
  increment: number;
}

/**
 * Full house state as returned by GET /house/:id. The admin_code is held
 * separately in the store (the API only ever returns it once, at creation).
 */
export interface HouseState {
  house_id: string;
  display_name: string;
  member_code: string;
  created_at: string;
  members: Member[];
  bills: Bill[];
}
