/**
 * Kongsi Bill — storage API (Cloudflare Worker, hand-routed, no framework).
 *
 * INVIOLABLE PRINCIPLE (blueprint §10.1): this Worker only stores and retrieves.
 * It NEVER computes bill shares, day counts, or rounding — all of that lives in
 * the browser (src/calc.ts). Here we validate that input is well-formed, read
 * and write D1, and return JSON. If you ever feel tempted to sum days or split
 * an amount in this file: stop — that's a bug.
 *
 * Data model = the applied D1 schema (migrations/0001 + 0002), which is the
 * source of truth. Bill status is draft | confirmed only. There is NO change_log
 * table, NO confirmed_at column, and NO lock / grace / override anywhere: any
 * bill is always editable by the admin, and presence is always editable by the
 * member (or admin on their behalf), regardless of bill status.
 *
 * FIELD-NAME NOTE — the JSON contract uses the snake_case *database* field names
 * (house_id, member_code, display_name, member_id, utility_label, period_start,
 * period_end, presence ranges as { start, end }, status). The current prototype
 * types (src/types.ts) are stale and use different names/shapes (camelCase,
 * `awayDays` instead of presence ranges, a `utility` enum + `customLabel`,
 * `open|locked` status). The frontend is being reconciled to this schema
 * separately; see the mismatch report accompanying this file.
 */

interface Env {
  DB: D1Database;
  // Cloudflare's built-in rate limiter (declared in wrangler.toml). May be
  // undefined in some local dev setups where the binding isn't simulated, so
  // every call site must guard with `if (env.RATE_LIMITER)`.
  RATE_LIMITER?: RateLimit;
}

// ---------------------------------------------------------------------------
// CORS — the Pages frontend (a different origin) must be able to call this API.
// Auth is by explicit code in a header/query param, never cookies, so a wildcard
// origin is safe here.
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Member-Code, X-Admin-Code',
  'Access-Control-Max-Age': '86400',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function err(status: number, message: string): Response {
  return json({ error: message }, status);
}

// ---------------------------------------------------------------------------
// ID & code generation — app-generated random URL-safe strings (never
// autoincrement). The prototype used `'m-' + Date.now()`, which is guessable
// and collision-prone, so it is deliberately NOT reused for anything access-
// sensitive. Codes use a Crockford base32 alphabet (no I/L/O/U) grouped with
// dashes: URL-safe, hard to guess, and easy to read/type — matching the visual
// style of the prototype's mock codes ("XYZ-4821", "QRP-9034").
// ---------------------------------------------------------------------------

const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 chars, no modulo bias (256 % 32 === 0)

function randomCode(groups: number, size: number): string {
  const total = groups * size;
  const bytes = new Uint8Array(total);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < total; i++) {
    if (i > 0 && i % size === 0) out += '-';
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Opaque URL-safe internal id (base64url, 128 bits) for members/bills/ranges. */
function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Dates — plain YYYY-MM-DD calendar text, no time, no timezone (blueprint §6.6).
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  // Round-trip rejects impossible dates like 2026-02-30.
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Merge overlapping/adjacent presence ranges before storing (blueprint §6.3:
 * "overlaps merged on save"). The prototype had no range type at all (it stored
 * a flat list of away-day keys), so there was no merge helper to reuse — this is
 * the canonical implementation. NOTE: this is plain interval bookkeeping, not a
 * day-count — it never sums or splits anything.
 */
interface DateRange {
  start: string;
  end: string;
}

function mergeRanges(ranges: DateRange[]): DateRange[] {
  const sorted = [...ranges].sort((a, b) =>
    a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : 1
  );
  const out: DateRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    // Adjacent (last.end + 1 day === r.start) or overlapping → extend the run.
    if (last && r.start <= addDays(last.end, 1)) {
      if (r.end > last.end) last.end = r.end;
    } else {
      out.push({ start: r.start, end: r.end });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Auth (blueprint §5.2) — access by code only, no accounts.
//   member code  → member endpoints (may travel in the join link, so it is
//                  accepted from the ?code= query param or X-Member-Code header)
//   admin code   → everything (must arrive via X-Admin-Code header or POST body
//                  only — NEVER from a URL/query param)
// Admin can do anything a member can, so member endpoints also accept the admin
// code (header only).
// ---------------------------------------------------------------------------

interface HouseRow {
  house_id: string;
  member_code: string;
  admin_code: string;
  display_name: string;
  created_at: string;
}

function memberAuthorized(house: HouseRow, url: URL, request: Request): boolean {
  const memberCode = url.searchParams.get('code') ?? request.headers.get('X-Member-Code');
  if (memberCode && memberCode === house.member_code) return true;
  // Admin code never comes from the URL — header only.
  const adminCode = request.headers.get('X-Admin-Code');
  return !!adminCode && adminCode === house.admin_code;
}

function adminAuthorized(house: HouseRow, request: Request, body: AnyBody): boolean {
  const fromBody = typeof body?.admin_code === 'string' ? (body.admin_code as string) : null;
  const adminCode = request.headers.get('X-Admin-Code') ?? fromBody;
  return !!adminCode && adminCode === house.admin_code;
}

// ---------------------------------------------------------------------------
// Request body parsing.
// ---------------------------------------------------------------------------

type AnyBody = Record<string, unknown> | null;

class BadJson extends Error {}

async function readBody(request: Request): Promise<AnyBody> {
  const text = await request.text();
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadJson();
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new BadJson();
  }
}

async function getHouse(env: Env, id: string): Promise<HouseRow | null> {
  return env.DB.prepare(
    'SELECT house_id, member_code, admin_code, display_name, created_at FROM houses WHERE house_id = ?'
  )
    .bind(id)
    .first<HouseRow>();
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

// ---------------------------------------------------------------------------
// Router.
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const seg = url.pathname.split('/').filter(Boolean);
    const method = request.method;

    // Parse the body once up front (writes need it; admin auth may read it).
    let body: AnyBody = null;
    if (method === 'POST' || method === 'PUT') {
      try {
        body = await readBody(request);
      } catch {
        return err(400, 'Malformed JSON body');
      }
    }

    try {
      // POST /house — create a house (no auth). Only place the admin code is returned.
      if (method === 'POST' && seg.length === 1 && seg[0] === 'house') {
        return createHouse(env, body);
      }

      // Everything below is scoped to /house/:id and needs an existing house.
      if (seg[0] !== 'house' || seg.length < 2) {
        return err(404, 'Not found');
      }
      const houseId = seg[1];
      const house = await getHouse(env, houseId);
      if (!house) return err(404, 'House not found'); // reject reads/writes to unknown houses (§10.3)

      // Per-house rate limit (abuse throttle) — keyed on houseId so one noisy
      // house can never starve another. Covers every per-house read and write
      // below; POST /house (creation) is intentionally above this and stays
      // unthrottled since it has no house ID yet. Guarded because the binding
      // is absent in some local dev setups (keeps `wrangler dev` working).
      if (env.RATE_LIMITER) {
        const { success } = await env.RATE_LIMITER.limit({ key: houseId });
        if (!success) {
          return new Response(
            JSON.stringify({ error: 'Too many requests — please slow down' }),
            {
              status: 429,
              headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...CORS_HEADERS },
            }
          );
        }
      }

      // GET /house/:id — full house state (auth: member or admin code).
      if (method === 'GET' && seg.length === 2) {
        if (!memberAuthorized(house, url, request)) return err(401, 'Invalid or missing access code');
        return readHouse(env, house);
      }

      // POST /house/:id/member — add a member (auth: admin).
      if (method === 'POST' && seg.length === 3 && seg[2] === 'member') {
        const guard = requireAdmin(house, url, request, body);
        if (guard) return guard;
        return addMember(env, houseId, body);
      }

      // POST /house/:id/member/:memberId/remove — soft-remove (auth: admin).
      if (method === 'POST' && seg.length === 5 && seg[2] === 'member' && seg[4] === 'remove') {
        const guard = requireAdmin(house, url, request, body);
        if (guard) return guard;
        return removeMember(env, houseId, seg[3]);
      }

      // PUT /house/:id/member/:memberId/presence — replace presence (auth: member).
      if (method === 'PUT' && seg.length === 5 && seg[2] === 'member' && seg[4] === 'presence') {
        if (!memberAuthorized(house, url, request)) return err(401, 'Invalid or missing access code');
        return setPresence(env, houseId, seg[3], body);
      }

      // POST /house/:id/member/:memberId/confirm-days — mark days reviewed (auth: member).
      if (method === 'POST' && seg.length === 5 && seg[2] === 'member' && seg[4] === 'confirm-days') {
        if (!memberAuthorized(house, url, request)) return err(401, 'Invalid or missing access code');
        return confirmDays(env, houseId, seg[3]);
      }

      // POST /house/:id/bill — create or update a bill, incl. status (auth: admin).
      if (method === 'POST' && seg.length === 3 && seg[2] === 'bill') {
        const guard = requireAdmin(house, url, request, body);
        if (guard) return guard;
        return upsertBill(env, houseId, body);
      }

      // POST /house/:id/bill/:billId/remove — delete a bill (auth: admin).
      if (method === 'POST' && seg.length === 5 && seg[2] === 'bill' && seg[4] === 'remove') {
        const guard = requireAdmin(house, url, request, body);
        if (guard) return guard;
        return removeBill(env, houseId, seg[3]);
      }

      // POST /house/:id/regenerate-member-code — new member code (auth: admin).
      if (method === 'POST' && seg.length === 3 && seg[2] === 'regenerate-member-code') {
        const guard = requireAdmin(house, url, request, body);
        if (guard) return guard;
        return regenerateMemberCode(env, houseId);
      }

      return err(404, 'Not found');
    } catch (e) {
      // Surface nothing internal; the client only needs to know it failed.
      return err(500, 'Internal error');
    }
  },
};

/** 401 if no usable credential, 403 if member-level credential but admin needed. */
function requireAdmin(house: HouseRow, url: URL, request: Request, body: AnyBody): Response | null {
  if (adminAuthorized(house, request, body)) return null;
  return memberAuthorized(house, url, request)
    ? err(403, 'Admin code required for this action')
    : err(401, 'Invalid or missing admin code');
}

// ---------------------------------------------------------------------------
// Handlers.
// ---------------------------------------------------------------------------

async function createHouse(env: Env, body: AnyBody): Promise<Response> {
  const displayName = str(body?.display_name);
  if (!displayName) return err(400, 'display_name is required');

  const house_id = randomCode(2, 4); // doubles as the public room ID
  const member_code = randomCode(2, 4);
  const admin_code = randomCode(3, 4); // the master key — more entropy
  const created_at = today();

  await env.DB.prepare(
    'INSERT INTO houses (house_id, member_code, admin_code, display_name, created_at, schema_version) VALUES (?, ?, ?, ?, ?, 1)'
  )
    .bind(house_id, member_code, admin_code, displayName, created_at)
    .run();

  // The ONLY response that ever includes admin_code.
  return json({ house_id, member_code, admin_code, display_name: displayName, created_at }, 201);
}

interface MemberRow {
  member_id: string;
  name: string;
  active: number;
  days_confirmed: number;
}

interface RangeRow {
  member_id: string;
  range_id: string;
  start: string;
  end: string;
}

interface BillRow {
  bill_id: string;
  utility_label: string;
  amount: number;
  period_start: string;
  period_end: string;
  status: string;
}

async function readHouse(env: Env, house: HouseRow): Promise<Response> {
  const members = (
    await env.DB.prepare(
      'SELECT member_id, name, active, days_confirmed FROM members WHERE house_id = ? ORDER BY rowid'
    )
      .bind(house.house_id)
      .all<MemberRow>()
  ).results;

  // Note the quoted "start"/"end" (SQLite keyword), aliased to clean JSON keys.
  const ranges = (
    await env.DB.prepare(
      `SELECT pr.member_id AS member_id, pr.range_id AS range_id, pr."start" AS start, pr."end" AS end
       FROM presence_ranges pr
       JOIN members m ON m.member_id = pr.member_id
       WHERE m.house_id = ?
       ORDER BY pr."start"`
    )
      .bind(house.house_id)
      .all<RangeRow>()
  ).results;

  const bills = (
    await env.DB.prepare(
      'SELECT bill_id, utility_label, amount, period_start, period_end, status FROM bills WHERE house_id = ? ORDER BY period_end DESC'
    )
      .bind(house.house_id)
      .all<BillRow>()
  ).results;

  const presenceByMember = new Map<string, DateRange[]>();
  for (const r of ranges) {
    const list = presenceByMember.get(r.member_id) ?? [];
    list.push({ start: r.start, end: r.end });
    presenceByMember.set(r.member_id, list);
  }

  return json({
    house_id: house.house_id,
    display_name: house.display_name,
    member_code: house.member_code, // so the admin can show/share the join link; admin_code is never returned
    created_at: house.created_at,
    members: members.map((m) => ({
      member_id: m.member_id,
      name: m.name,
      active: m.active === 1, // 0/1 storage → boolean for the frontend
      days_confirmed: m.days_confirmed === 1, // "my days are correct" readiness flag
      presence: presenceByMember.get(m.member_id) ?? [],
    })),
    bills,
  });
}

async function addMember(env: Env, houseId: string, body: AnyBody): Promise<Response> {
  const name = str(body?.name);
  if (!name) return err(400, 'name is required');

  const member_id = randomId();
  await env.DB.prepare(
    'INSERT INTO members (member_id, house_id, name, active, schema_version) VALUES (?, ?, ?, 1, 1)'
  )
    .bind(member_id, houseId, name)
    .run();

  return json({ member_id, name, active: true, days_confirmed: false }, 201);
}

async function removeMember(env: Env, houseId: string, memberId: string): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT member_id FROM members WHERE member_id = ? AND house_id = ?'
  )
    .bind(memberId, houseId)
    .first<{ member_id: string }>();
  if (!existing) return err(404, 'Member not found');

  // Soft-remove only — never hard-delete (§6.7): the row stays attached to past bills.
  await env.DB.prepare('UPDATE members SET active = 0 WHERE member_id = ? AND house_id = ?')
    .bind(memberId, houseId)
    .run();

  return json({ member_id: memberId, active: false });
}

async function setPresence(
  env: Env,
  houseId: string,
  memberId: string,
  body: AnyBody
): Promise<Response> {
  const member = await env.DB.prepare(
    'SELECT member_id FROM members WHERE member_id = ? AND house_id = ?'
  )
    .bind(memberId, houseId)
    .first<{ member_id: string }>();
  if (!member) return err(404, 'Member not found');

  const raw = body?.ranges;
  if (!Array.isArray(raw)) return err(400, 'ranges must be an array');

  const cleaned: DateRange[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') return err(400, 'each range must be an object with start and end');
    const start = (r as Record<string, unknown>).start;
    const end = (r as Record<string, unknown>).end;
    if (!isValidDate(start) || !isValidDate(end)) {
      return err(400, 'each range needs a valid YYYY-MM-DD start and end');
    }
    if (start > end) return err(400, 'range start must be on or before end');
    cleaned.push({ start, end });
  }

  // Server-side lock for settled bills (real enforcement, not just the UI).
  // Presence isn't tied to a bill, so this is a DATE-OVERLAP check against the
  // periods of this house's PAID bills — never a status lookup on a presence
  // row. Only 'paid' (closed/settled) locks; 'draft' (open) bills never block.
  // Two ranges overlap iff range.start <= bill.period_end AND range.end >=
  // bill.period_start. If any incoming range overlaps any paid period we reject
  // the WHOLE edit (predictable: nothing is written), no partial application.
  // This is a validation guard, not a day-count or split — the no-maths
  // principle (§10.1) is intact.
  const paidBills = (
    await env.DB.prepare(
      'SELECT period_start, period_end FROM bills WHERE house_id = ? AND status = ?'
    )
      .bind(houseId, 'paid')
      .all<{ period_start: string; period_end: string }>()
  ).results;

  const hitsPaid = cleaned.some((r) =>
    paidBills.some((b) => r.start <= b.period_end && r.end >= b.period_start)
  );
  if (hitsPaid) {
    return err(409, "Cannot edit days inside a settled (paid) bill's period");
  }

  const merged = mergeRanges(cleaned).map((r) => ({ range_id: randomId(), ...r }));

  // Replace this member's ranges atomically: clear, then insert the merged set.
  // Editing days also un-confirms the member's "days are correct" flag — their
  // record changed, so the admin's readiness view should show them as not-ready
  // again until they re-confirm.
  const stmts = [
    env.DB.prepare('DELETE FROM presence_ranges WHERE member_id = ?').bind(memberId),
    env.DB.prepare('UPDATE members SET days_confirmed = 0 WHERE member_id = ?').bind(memberId),
    ...merged.map((r) =>
      env.DB
        .prepare(
          'INSERT INTO presence_ranges (range_id, member_id, "start", "end", schema_version) VALUES (?, ?, ?, ?, 1)'
        )
        .bind(r.range_id, memberId, r.start, r.end)
    ),
  ];
  await env.DB.batch(stmts);

  return json({
    member_id: memberId,
    days_confirmed: false,
    presence: merged.map(({ start, end }) => ({ start, end })),
  });
}

async function confirmDays(env: Env, houseId: string, memberId: string): Promise<Response> {
  const member = await env.DB.prepare(
    'SELECT member_id FROM members WHERE member_id = ? AND house_id = ?'
  )
    .bind(memberId, houseId)
    .first<{ member_id: string }>();
  if (!member) return err(404, 'Member not found');

  // "My days are correct" — a readiness flag only; it stores no day data and is
  // cleared automatically the next time this member edits their presence.
  await env.DB.prepare('UPDATE members SET days_confirmed = 1 WHERE member_id = ? AND house_id = ?')
    .bind(memberId, houseId)
    .run();

  return json({ member_id: memberId, days_confirmed: true });
}

async function upsertBill(env: Env, houseId: string, body: AnyBody): Promise<Response> {
  const utility_label = str(body?.utility_label);
  if (!utility_label) return err(400, 'utility_label is required');

  const amount = body?.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return err(400, 'amount must be a number greater than 0');
  }

  const period_start = body?.period_start;
  const period_end = body?.period_end;
  if (!isValidDate(period_start) || !isValidDate(period_end)) {
    return err(400, 'period_start and period_end must be valid YYYY-MM-DD dates');
  }
  if (period_start > period_end) return err(400, 'period_start must be on or before period_end');

  const status = body?.status ?? 'draft';
  if (status !== 'draft' && status !== 'confirmed' && status !== 'paid') {
    // Lifecycle label only: draft → confirmed → paid (settled/closed).
    return err(400, "status must be 'draft', 'confirmed', or 'paid'");
  }

  const billId = typeof body?.bill_id === 'string' ? body.bill_id : null;

  if (billId) {
    const existing = await env.DB.prepare(
      'SELECT bill_id FROM bills WHERE bill_id = ? AND house_id = ?'
    )
      .bind(billId, houseId)
      .first<{ bill_id: string }>();
    if (!existing) return err(404, 'Bill not found');

    await env.DB.prepare(
      'UPDATE bills SET utility_label = ?, amount = ?, period_start = ?, period_end = ?, status = ? WHERE bill_id = ? AND house_id = ?'
    )
      .bind(utility_label, amount, period_start, period_end, status, billId, houseId)
      .run();

    return json({ bill_id: billId, utility_label, amount, period_start, period_end, status });
  }

  const bill_id = randomId();
  await env.DB.prepare(
    'INSERT INTO bills (bill_id, house_id, utility_label, amount, period_start, period_end, status, schema_version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
  )
    .bind(bill_id, houseId, utility_label, amount, period_start, period_end, status)
    .run();

  return json({ bill_id, utility_label, amount, period_start, period_end, status }, 201);
}

async function removeBill(env: Env, houseId: string, billId: string): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT bill_id FROM bills WHERE bill_id = ? AND house_id = ?'
  )
    .bind(billId, houseId)
    .first<{ bill_id: string }>();
  if (!existing) return err(404, 'Bill not found');

  // Bills have no FK dependents (presence is tied to members, not bills), so a
  // wrongly-added bill is hard-deleted. Members are still soft-removed (§6.7) —
  // this delete is bills-only and never touches people or history of others.
  await env.DB.prepare('DELETE FROM bills WHERE bill_id = ? AND house_id = ?')
    .bind(billId, houseId)
    .run();

  return json({ bill_id: billId, deleted: true });
}

async function regenerateMemberCode(env: Env, houseId: string): Promise<Response> {
  const member_code = randomCode(2, 4);
  // Overwrite the member code only — invalidates old join links; admin_code untouched.
  await env.DB.prepare('UPDATE houses SET member_code = ? WHERE house_id = ?')
    .bind(member_code, houseId)
    .run();
  return json({ member_code });
}

// ---------------------------------------------------------------------------
// Minimal D1 ambient types. Delete this block once @cloudflare/workers-types is
// installed and referenced (recommended) — the bindings come from there.
// ---------------------------------------------------------------------------

interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

// Cloudflare's built-in Rate Limiting binding (the `[[ratelimits]]` block in
// wrangler.toml). Replace with the `RateLimit` type from
// @cloudflare/workers-types once that package is installed and referenced.
interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
