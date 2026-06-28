// Worker API client — the JSON contract in worker/index.ts is the source of
// truth, and this module is the *only* place the frontend talks to it.
//
// Auth rules (blueprint §5.2), enforced here so callers can't get them wrong:
//   * member endpoints send the member code via the X-Member-Code header
//     (the Worker also accepts ?code=, but a header keeps it out of logs/URLs)
//   * admin endpoints send the admin code via the X-Admin-Code header ONLY —
//     never in a URL/query param.
// The admin code can do anything a member can, so it is also accepted on member
// endpoints; callers pass whichever code they hold.

import type { Bill, BillStatus, DateRange, HouseState, Member, PaidSnapshotEntry } from './types';

/**
 * Base URL of the API. The frontend and the Worker are now served from the same
 * origin (one Worker serves both static assets and the API), so this defaults to
 * '' → same-origin relative requests like `/api/house/...`. VITE_API_BASE is optional
 * and only needs setting to point at a different origin (e.g. a remote Worker
 * while running the Vite dev server locally).
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  /** Member code — sent as X-Member-Code. */
  memberCode?: string | null;
  /** Admin code — sent as X-Admin-Code (header only, never the URL). */
  adminCode?: string | null;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.memberCode) headers['X-Member-Code'] = opts.memberCode;
  if (opts.adminCode) headers['X-Admin-Code'] = opts.adminCode;

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in data && String(data.error)) ||
      `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Response shapes (only what each endpoint actually returns).
// ---------------------------------------------------------------------------

export interface CreatedHouse {
  house_id: string;
  member_code: string;
  /** The ONLY response that ever carries the admin code. Keep it locally. */
  admin_code: string;
  display_name: string;
  created_at: string;
}

export interface BillInput {
  /** Provide to update an existing bill; omit to create a new one. */
  bill_id?: string;
  utility_label: string;
  amount: number;
  period_start: string;
  period_end: string;
  status?: BillStatus;
  /**
   * Frozen split, sent only when settling a bill (status → 'paid'). Computed in
   * the browser (calc.ts) and stored verbatim by the Worker — `null` (or omitted)
   * for draft writes, which clears any stale snapshot.
   */
  paid_snapshot?: PaidSnapshotEntry[] | null;
}

// ---------------------------------------------------------------------------
// Endpoints.
// ---------------------------------------------------------------------------

/** POST /api/house — create a house. No auth. Returns the admin code (once). */
export function createHouse(display_name: string): Promise<CreatedHouse> {
  return request<CreatedHouse>('/api/house', { method: 'POST', body: { display_name } });
}

/** GET /api/house/:id — full house state (auth: member or admin code). */
export function getHouseState(
  houseId: string,
  codes: { memberCode?: string | null; adminCode?: string | null }
): Promise<HouseState> {
  return request<HouseState>(`/api/house/${encodeURIComponent(houseId)}`, {
    memberCode: codes.memberCode,
    adminCode: codes.adminCode,
  });
}

/** POST /api/house/:id/member — add a member (auth: admin). */
export function addMember(
  houseId: string,
  name: string,
  adminCode: string
): Promise<Pick<Member, 'member_id' | 'name' | 'active' | 'days_confirmed'>> {
  return request(`/api/house/${encodeURIComponent(houseId)}/member`, {
    method: 'POST',
    body: { name },
    adminCode,
  });
}

/** POST /api/house/:id/member/:memberId/remove — soft-remove (auth: admin). */
export function removeMember(
  houseId: string,
  memberId: string,
  adminCode: string
): Promise<{ member_id: string; active: boolean }> {
  return request(
    `/api/house/${encodeURIComponent(houseId)}/member/${encodeURIComponent(memberId)}/remove`,
    { method: 'POST', adminCode }
  );
}

/** PUT /api/house/:id/member/:memberId/presence — replace presence (auth: member). */
export function setPresence(
  houseId: string,
  memberId: string,
  ranges: DateRange[],
  codes: { memberCode?: string | null; adminCode?: string | null }
): Promise<{ member_id: string; presence: DateRange[] }> {
  return request(
    `/api/house/${encodeURIComponent(houseId)}/member/${encodeURIComponent(memberId)}/presence`,
    { method: 'PUT', body: { ranges }, memberCode: codes.memberCode, adminCode: codes.adminCode }
  );
}

/** POST /api/house/:id/bill — create or update a bill incl. status (auth: admin). */
export function upsertBill(houseId: string, bill: BillInput, adminCode: string): Promise<Bill> {
  return request(`/api/house/${encodeURIComponent(houseId)}/bill`, {
    method: 'POST',
    body: bill,
    adminCode,
  });
}

/** POST /api/house/:id/member/:memberId/confirm-days — mark days reviewed (auth: member). */
export function confirmDays(
  houseId: string,
  memberId: string,
  codes: { memberCode?: string | null; adminCode?: string | null }
): Promise<{ member_id: string; days_confirmed: boolean }> {
  return request(
    `/api/house/${encodeURIComponent(houseId)}/member/${encodeURIComponent(memberId)}/confirm-days`,
    { method: 'POST', memberCode: codes.memberCode, adminCode: codes.adminCode }
  );
}

/** POST /api/house/:id/bill/:billId/remove — delete a bill (auth: admin). */
export function deleteBill(
  houseId: string,
  billId: string,
  adminCode: string
): Promise<{ bill_id: string; deleted: boolean }> {
  return request(
    `/api/house/${encodeURIComponent(houseId)}/bill/${encodeURIComponent(billId)}/remove`,
    { method: 'POST', adminCode }
  );
}

/** POST /api/house/:id/regenerate-member-code — new member code (auth: admin). */
export function regenerateMemberCode(
  houseId: string,
  adminCode: string
): Promise<{ member_code: string }> {
  return request(`/api/house/${encodeURIComponent(houseId)}/regenerate-member-code`, {
    method: 'POST',
    adminCode,
  });
}
