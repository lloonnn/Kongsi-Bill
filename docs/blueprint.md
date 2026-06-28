# Kongsi Bill — Project Blueprint

*A day-weighted utility bill splitter for shared households.*

**Document status:** design reference. This is the design reference for what Kongsi Bill is, what it does, and how it is built. It seeds the repository README and guides the UI/UX design stage. Where the built code and config have moved on from the original v1 design, this document has been reconciled to the code (the code + config in `worker/`, `wrangler.toml`, `src/`, and `migrations/` are the source of truth); the frontend remains at prototype stage and its screen design is not final.

**Last updated:** 28 June 2026

---

## 1. Executive summary

Kongsi Bill is a hosted web application that splits shared-household utility bills (electricity, water, gas, and similar) between housemates according to how many days each person was actually present during each bill's billing period. One housemate acts as the person-in-charge (PIC); they enter the bills, everyone records the days they were home, and the app produces a fair per-person amount with the underlying maths shown openly so any result can be verified by hand.

The product is deliberately scoped to be **low-maintenance and low/predictable cost**. The core calculation runs entirely in the user's browser; a thin serverless layer only stores and retrieves data. Hosted on free infrastructure tiers, the realistic running cost is **$0 per month**, and the platform stops rather than bills when free limits are reached — so a surprise invoice is structurally impossible at this scale.

The name "Kongsi" means *to share among a group* in Malay, reflecting both the function and the Singapore/Malaysia context the app is built for.

---

## 2. Problem & context

### 2.1 The problem

In shared rentals where rent excludes utilities, someone has to work out who owes what each time a bill arrives. This is harder than an equal split because:

- The number of housemates changes over time as people join and leave.
- People are frequently away — travel, work, time at family homes — so an equal split is unfair to those who were barely there.
- Electricity, water, and gas are billed on **different dates, for different amounts, over different periods**, so each utility must be worked out independently.
- The maths is fiddly and error-prone to do by hand or in a spreadsheet, and the spreadsheet approach breaks down when the PIC role passes to someone less comfortable with numbers.

### 2.2 Who it is for

- **Primary users:** rental households in Singapore and Malaysia, used on phones, by non-technical people.
- **The PIC (person-in-charge):** a rotating role. The current design assumption is that the next PIC may not be technical, so usability and clean handoff matter as much as calculation correctness.
- **Housemates:** record their own days of presence and can see how a bill was split, for transparency and trust.

### 2.3 Design priorities (in order)

1. **Correctness** — the money split must be right and verifiable.
2. **Low maintenance** — the creator is pursuing other career goals and cannot babysit the app.
3. **Low, predictable cost** — ideally $0; never a usage-driven surprise bill.
4. **Usability & handoff** — a non-technical PIC must be able to pick it up.
5. **Transparency** — the formula is open and every result is auditable by hand.

Feature richness is explicitly *not* a priority. Throughout the design, complexity has been cut wherever it does not serve the five priorities above.

---

## 3. The calculation (source of truth)

### 3.1 Core formula

Each utility is calculated **independently**, per bill. For a single bill covering a billing period `[start, end]`:

```
person_days_i      = number of days person i was present, counted ONLY within [start, end]
total_person_days  = sum of person_days over all housemates
person_share_i     = (person_days_i / total_person_days) × bill_amount
```

A person's final amount across a settlement is the **sum of their shares across all bills**.

### 3.2 Worked example

Electricity bill: amount = $100.00, period = 1–31 Jan (31 days).

| Person | Presence in period | Days |
|--------|--------------------|------|
| Alice  | All month          | 31   |
| Bob    | 1–15 Jan           | 15   |
| Carol  | All month, away 10–19 Jan | 21 |

`total_person_days = 31 + 15 + 21 = 67`

| Person | Calculation        | Share (to the cent) |
|--------|--------------------|---------------------|
| Alice  | 31 / 67 × 100      | 46.27     |
| Bob    | 15 / 67 × 100      | 22.39     |
| Carol  | 21 / 67 × 100      | 31.34     |
| **Sum**|                    | **100.00** ✓ |

The **Share** column is each person's amount rounded to the nearest cent — *not* the literal fraction (`31/67 × 100 = 46.2686…`). With rounding off, the shares are allocated to whole cents by **largest remainder** (the leftover cent or two go to the largest fractional parts) so they sum to **exactly** the bill amount. The sum reconciles with the bill total. Water and any other utility are computed the same way, with their own periods and day counts.

### 3.3 Rules, assumptions & edge cases

- **Whole days only.** A day counts if the person was present at any point that day. No half-days.
- **Clip to the billing period.** A person's presence is always intersected with each bill's period; days outside the period never count toward that bill. A person may safely record dates that fall outside any bill — they simply count toward nothing.
- **Cost is proportional to days present.** Actual usage intensity (e.g. someone running air-conditioning all day) is *not* modelled. This is intentional, for legibility and because per-day usage cannot be verified. Documented as an explicit assumption.
- **Overlapping/duplicate ranges are merged.** If a person records 1–10 Jan and 5–15 Jan, the overlap is merged so days are not double-counted. (Automatic, because presence is stored as real dates; the merge happens server-side in the Worker on save.)
- **Default to present for the whole period.** Presence is stored as the ranges a member was *present* (home). A member who has recorded **no** presence ranges at all is counted as present for the entire bill period, not as zero — an unmarked housemate still takes a fair share rather than silently dropping out. A member counts as zero only if they have recorded ranges and none of them overlap the bill's period.
- **Zero-denominator guard.** If `total_person_days = 0` for a bill (everyone with recorded ranges is away across the whole period), the split is undefined and is **flagged**, not crashed.
- **Reconciliation check.** The sum of raw shares must equal the bill amount within a small tolerance; any mismatch is flagged with a plain-language explanation of the likely cause.

### 3.4 Optional rounding

- A toggle, **off by default** (full-precision/2-decimal shares).
- When on, the PIC chooses **round down** or **round up** to the nearest 0.05.
- Rounding is applied **only to the final per-person totals**, never mid-calculation.
- The **remainder is surfaced**, not auto-assigned. Round-down means the house collects slightly less than the bill (someone covers the gap); round-up means slightly more (a small surplus). The UI labels each option by its real-world consequence so the PIC understands the trade, not just the direction.

---

## 4. Scope decision

Three tiers were considered. **Tier 2 is the chosen scope.**

| Tier | What it is | Verdict |
|------|-----------|---------|
| ① Stateless calculator | Pure in-browser calculator, no stored history; PIC keeps an exported file. | Rejected — cannot cleanly export full multi-bill history, no shared per-house record. |
| **② Single-house app, multi-tenant, no accounts** | **Houses with room codes, saved per-house history, two-code access, serverless storage.** | **Chosen.** Persistent shared history and clean exports without the liability of accounts. |
| ③ Full multi-tenant with accounts | Individual logins, admin/member roles, password resets, real database. | Rejected — authentication, privacy duties, and open-ended support burden conflict directly with the low-maintenance goal. |

### 4.1 What Tier 2 deliberately avoids

No individual user accounts, no passwords, no email/login, no always-on database server, no per-request server rendering, no PDF reading, no in-app payment tracking, no notifications/reminders, no real-time collaborative editing, no onboarding tutorial. Each of these was considered and cut as maintenance or cost surface that does not serve the core goals.

---

## 5. Access & multi-tenant model

### 5.1 Houses

- An **admin** creates a house and receives a **room ID** plus two codes.
- **Multiple houses** are fully isolated; each has its own members, bills, and history. No house can see another's data.

### 5.2 Two-code scheme (no accounts)

| Code | Held by | Can do |
|------|---------|--------|
| **Member code** | All housemates | Join the house, record their own presence days, view splits. |
| **Admin code** | The PIC only | Everything members can, plus create cycles, add/edit bills, calculate a cycle, settle a cycle (mark its bills paid, freezing each split), manage members, regenerate the member code, export. |

Admin is a **capability, not a separate entity**: there is no `admin_member_id` and no admin record. The PIC is simply whoever holds the admin code, and is otherwise an ordinary member (or not a member at all — see §5.2.1). The codes *are* the access mechanism — there is no separate identity. This is the deliberate trade that removes authentication entirely. Its accepted limitations: the app cannot prove *which* member acted (no per-person accountability), and security depends on codes being kept within the house.

### 5.2.1 The creator and house membership

Because the admin is just the holder of the admin code, creating a house does **not** automatically create a member for the creator. At setup the creator is **prompted** to add themselves as the first housemate (if they also live there and share the bills) but is not forced to — the add-housemates step can be skipped. A house may therefore validly have **zero members**; the split calculation handles an empty house by flagging "no housemates yet" rather than breaking.

### 5.3 Entry paths

- **Members** use a **one-tap join link** with the member code embedded:
  `/join?house=ABC123&code=XYZ` — built **same-origin/relative** from wherever the app is served (in production, `https://kongsi-bill.app-my.workers.dev`), so it always points at the right place.
  This drops them straight into their house's day-entry view with no typing. The link carries the keys, so it lives only in the house group chat.
- **Admins** use a separate **manage path** (`/manage`) and enter the admin code. The admin code is **never embedded in a link** — it stays typed and private.
- Asymmetry by design: member code travels in links (convenience); admin code never does (protection).

### 5.4 Code lifecycle

- **Leaked or departed-member concern:** regenerate the member code; this invalidates all old join links at once, and the admin sends a fresh link.
- **Lost codes:** accepted risk. With no accounts there is no recovery path; a lost admin code with no one holding it orphans the house. Mitigated by a prominent, hard-to-skip "save your codes" step at creation (copy-all, download, and an "I've saved these" confirmation).
- **PIC handoff:** transferring admin = sharing the admin code with the next PIC (optionally regenerating it so the old one stops working), surfaced as an explicit "hand over to new PIC" action plus a shareable house info card (room ID, join link, admin note).

### 5.5 The admin code in practice

A focused reference for whoever becomes PIC. The admin code is the master key for a single house and the only proof of PIC status (there are no accounts).

- **Powers it unlocks** (everything a member can do, plus): create a cycle and add/edit bills in it while they are open; calculate a cycle; **settle a cycle** — marking its bills paid, which saves a snapshot of each split and finalizes the cycle into History (see §7); add/soft-remove members; export latest cycle or full history; regenerate the member code; hand over to the next PIC. (There is no time-based lock and no admin override — an open bill stays fully editable for as long as it is open; see §7.)
- **When used:** roughly once per billing cycle (create cycle → add its bills → collect days → Calculate → settle), plus off-cycle housekeeping (member changes, a leaked code).
- **How used — typed, never linked:** the admin reaches the manage path (`/manage`) and **types the admin code by hand each time**. Unlike the member code, it is never embedded in a link, because the member join link is pasted into the house group chat where it is visible. Typing keeps the admin code out of chat history and link previews. This is the deliberate asymmetry from §5.3.
- **Unrecoverable:** with no accounts there is no reset. A lost admin code with no holder orphans the house (members can still view, but no one can administer). This is why the save-codes step at creation (§5.4) is treated as the one critical, unskippable moment, and why handoff means deliberately passing the code on.

Note the admin code is the only code that is *typed* and never travels in a link. The two codes are otherwise symmetric in storage — both live on the `houses` row (`member_code`, `admin_code`); there is no member record marking who the admin is.

---

## 6. Data model

Field names are indicative and become the TypeScript types shared across the frontend, Worker, and database. Every stored record carries a `schema_version` for safe future migration.

### 6.1 House
```
house_id          string   (room ID, also the storage key)
member_code       string
admin_code        string
display_name      string
created_at        date
schema_version    integer
```

### 6.2 Member (housemate)
```
member_id         string
house_id          string   (which house)
name              string
active            boolean   (false = soft-removed; stays attached to past bills; soft-remove is one-way — there is no restore endpoint)
days_confirmed    boolean   (readiness signal: "my days are correct"; auto-cleared whenever the member edits their presence)  [added in migration 0003]
schema_version    integer
```
`days_confirmed` is purely a readiness flag for the admin's view (who has reviewed their days). It stores no day data, is set by the `confirm-days` endpoint, and is reset to `false` by the Worker whenever that member's presence ranges change.

### 6.3 Presence record (per member)
```
member_id         string
ranges            list of { start: date, end: date }   (multiple ranges; overlaps merged on save)
schema_version    integer
```
Each member owns their own presence ranges (stored one row per range in `presence_ranges`), so two members entering days touch different records and cannot overwrite each other. Ranges are the days the member was **present** (home). Overlapping/adjacent ranges are merged in the Worker on save. A member with no ranges at all is treated as present for the whole bill period by the calculation (§3.3).

### 6.4 Bill
```
bill_id           string
house_id          string
cycle_id          string    (which billing cycle this bill belongs to; FK → cycles.cycle_id)   [added in migration 0005]
utility_label     string   (single free text: "Electricity", "Water", "Gas", "Internet", or anything typed)
amount            number    (record-keeping only; never used to compute the split — that is done in the browser)
period_start      date
period_end        date
status            enum      (draft | paid; see §7)
paid_snapshot     JSON | null   (the split frozen at settlement; null while the bill is open)   [added in migration 0004]
schema_version    integer
```
Notes:
- `cycle_id` groups every bill under an admin-named **cycle** (§6.8). It is `NOT NULL` — a bill always belongs to a cycle — and the Worker verifies the cycle exists in the same house on write.
- `utility_label` is a single free-text field. The UI offers a convenience dropdown (Electricity / Water / Gas / Internet / Other → free text) that simply resolves to this one label; the preset list never travels to the API.
- `status` carries the two-state lifecycle: `draft` = **Open** (fully editable) and `paid` = **Settled/frozen**. The schema's `CHECK` constraint also still permits the legacy value `'confirmed'` (the original three-stage design), but it is **unused** by the current product — the lifecycle is just draft → paid.
- `paid_snapshot` is the **frozen split** the browser computes once, at the moment the bill is settled, and the Worker stores verbatim (a JSON array of `{ member_id, name, days, amount }`). A paid bill renders this snapshot and never recalculates, so its split is immutable regardless of later presence edits or member removals. It is `null` for any open (draft) bill, and for any bill settled before migration 0004. The Worker still computes nothing — it only persists what the browser produced.
- The original `confirmed_at` column (which started the 7-day grace window) was **dropped in migration 0002**; there is no grace window any more.

### 6.5 Change log — removed

The original design included a `change_log` table to record edits and admin overrides. It has been **removed entirely** — there is no change-log table, no audit trail, and nothing is "logged." This follows from dropping the lock/override model (§7): there are no overrides to record. Edits to an open bill are simply allowed; once a bill is paid its split is frozen by a saved snapshot (§7).

### 6.6 Date handling

- **Stored and computed** as plain calendar dates in `YYYY-MM-DD` — no time, no timezone.
- **Displayed** to users as `DD-MM-YYYY`.
- Mixing storage and display format this way is intentional and is how timezone/parsing bugs are avoided.

### 6.7 Soft-delete & lifecycle

- Departed housemates are **soft-removed** (`active = false`). Removal is **forward-only and never rewrites the past**: a settled bill keeps its saved `paid_snapshot` untouched, and an open bill still includes the member wherever their recorded presence overlaps the bill's period. Crucially, member inclusion in a split is decided by **presence-overlap with the bill period, not by the current `active` flag** (`src/calc.ts` `wasPresentInPeriod`) — so a soft-removed member keeps their rightful share of bills from while they lived here, and old splits still reconcile exactly. `active` only governs who appears in the *new-bill* UI, not who is counted in past bills. Soft-remove is **one-way** — there is no restore endpoint in the API.
- Members are never hard-deleted. **Bills**, by contrast, *can* be deleted outright (the "remove bill" action hard-deletes the row), because a bill has no dependents — presence is tied to members, not bills — so removing a mistaken bill leaves no dangling references and never touches anyone's history.

### 6.8 Billing cycle (migration 0005)
```
cycle_id          string    (primary key)
house_id          string    (which house)
display_name      string    (admin-typed, e.g. "June 2026")
status            enum      (open | finalized)
created_at        date
schema_version    integer
```
A **cycle** is an explicit, admin-named billing period that groups that period's bills (electricity + water + …). It replaces the earlier implicit "group bills by the month they end in." Key points:
- **Calculate acts on one cycle at a time** — it combines only that cycle's bills into each person's total, never across cycles (`groupBillsByCycle` in `src/calc.ts` feeds one cycle's bills into the existing, unchanged per-bill maths). Because cycles are explicit, two cycles may carry **overlapping dates** without interfering.
- `status` is `open` → `finalized` — a label only (like `bills.status`, it never gates storage). Settling a cycle's bills sets it to `finalized`.
- **Placement follows status (display only).** The admin bills screen shows **active** cycles — those whose status is not `finalized`, *or* that still have any `draft` bill; **finalized** cycles move to a **History** view (`src/cyclePlacement.ts` `isCycleActive`, with `AdminDashboard`/`AdminHistory`). Reopening a settled bill flips it back to `draft`, which pulls its whole cycle back to the active screen until it is calculated and settled again.
- **Endpoints:** `POST /api/house/:id/cycle` creates or updates a cycle (admin only), mirroring the bill-upsert endpoint; `GET /api/house/:id` returns the house's `cycles` array alongside its bills, and every bill carries its `cycle_id`.

Migration 0005 introduced the `cycles` table and the `bills.cycle_id` foreign key (wiping the pre-cycle test bills for a clean start).

---

## 7. Bill lifecycle, the freeze & cycles

The bill lifecycle is two states. The original three-stage draft → confirmed → locked model — with its 7-day grace period, time-based lock, and admin override — is **gone**.

1. **Open** (`status = draft`) — fully editable: the admin can change its amount, label, dates, or cycle, and housemates keep marking their days. **There is no time limit** — nothing about the passage of time locks it.
2. **Settled** (`status = paid`) — when the admin Calculates and settles the cycle, each of its bills is marked paid. Settling **saves a `paid_snapshot`** (§6.4): the browser computes the split once and stores it, and from then on the bill renders that snapshot and **never recalculates**.

**The snapshot is the freeze.** Because a settled bill displays its stored snapshot rather than a live recalculation, its split is immutable — editing presence, or soft-removing a member, can no longer change a bill that has already been paid. This is the primary, structural protection, and it is **per-bill**.

**A precise server-side guard, not a blanket date lock.** Earlier the Worker rejected any presence edit overlapping *any* paid bill's period — a calendar-wide sweep that wrongly blocked an unrelated bill in a different cycle from using the same dates. That is fixed. The guard (`presenceHitsLock` in `worker/index.ts`, mirrored on the client by `src/presenceLock.ts` `billFreezesPresence`) now rejects (HTTP **409**) a presence edit only when it overlaps a paid bill that has **no snapshot** — the one case where an edit could still shift a settled result. A paid bill **with** a snapshot is already frozen, so overlapping it is allowed, and a different cycle's bill may freely span the same dates (it just reads the frozen presence; it never rewrites it). Money-protection holds either way — frozen by the snapshot, or, for any legacy snapshot-less paid bill, by this date guard. The Worker still computes no shares (§10.1).

**Reopen.** A settled bill can be reopened (its `status` set back to `draft` via the bill-upsert endpoint), which clears its snapshot and makes it editable again. Because cycle placement follows status (§6.8), reopening a bill returns its whole cycle from History to the active screen until it is recalculated and settled. There is still no grace window, time-based lock, admin override, or audit log — settling and reopening are plain, deliberate status changes, and nothing is logged.

---

## 8. User flow

Three journeys plus lifecycle actions. (A visual flowchart of this exists alongside the blueprint.)

### Journey A — Admin sets up the house
1. Create house (first run, no data).
2. Receive room ID + two codes.
3. **Save codes** (copy/download, confirm saved) — the one unrecoverable step, given prominence.
4. Add housemates (variable count, no code edits). The creator is **prompted to add themselves first** if they share the bills, but this is optional and the step can be skipped — a house may have zero members at this point (§5.2.1).
5. Share the member join link into the house chat.

### Journey B — Member records presence
1. Open the one-tap join link → straight into the house.
2. Select days present on a calendar; add multiple date ranges to cover gaps when away.
3. Save own record (overlaps auto-merged).

*(Members can update presence any time; once a bill covering those dates is settled, that bill's split is frozen by its snapshot (§7), so a later edit can't change it. The admin can also enter days on a member's behalf. B feeding into C is the typical path, not the only one.)*

### Journey C — Admin calculates & finalises
1. **Create a cycle** (name the period, e.g. "June 2026") and add that period's bills (utility label, amount, billing period) into it.
2. **Calculate the cycle** — the app combines its bills and computes each person's total from everyone's presence, clipped to each bill's own period (never mixing in another cycle's bills).
3. Validate — reconciliation and zero-denominator flags, with actionable messages.
4. Optional rounding toggle (down/up, off by default); remainder surfaced.
5. When the cycle is settled, **settling marks its bills paid and saves each split's snapshot** (§7); the cycle is **finalized** and files into History. Until then it stays open and editable.

### View, export & lifecycle
- View history — **finalized cycles** in a History view (each cycle's bills combined into one per-person total); active/open cycles stay on the main screen (§6.8).
- Export — **latest cycle** (newest cycle with bills) or **full history** (all cycles), generated client-side as **CSV** of the final numbers (see §10.2).
- Lifecycle — soft-remove a departed housemate (one-way); regenerate a leaked code; delete a mistaken bill; **reopen** a settled bill to correct it (returns its cycle to active).

---

## 9. UX principles

Carried into the dedicated UI/UX stage; recorded here so they are not lost.

- **Default to "present the whole period."** Most housemates are home most of the time; let them subtract days away rather than build presence from nothing.
- **Live day-count** as days are selected ("You've marked 24 days present").
- **Copy last period's pattern** for recurring schedules. *(Comfort feature — v2.)*
- **Show the working**, not just the answer: display `Alice: 24/67 days × $100 = $35.82` so the on-screen result mirrors the audit principle.
- **Actionable flags:** a mismatch says what to do, not just that something's wrong.
- **Preview before settling:** since marking a bill paid closes it and freezes its period, show a clear summary with confirm/cancel before that step.
- **One-tap join link** to eliminate the most error-prone data entry.
- **Save-codes as the path of least resistance:** copy-all, download, "I've saved these" gate.
- **House info card** for clean PIC handoff.
- **Confirmation toasts** on every save; **guiding empty states**; **mobile-first** throughout; **plain-language labels** ("who pays what", "billing period") for a non-technical PIC.

---

## 10. Architecture & tech stack

### 10.1 Guiding principle

Push as much as possible into static files and the browser; keep the server doing the minimum. The app is fundamentally arithmetic plus a little storage, so the core logic is client-side, instant, free to run, and works even if the backend is down. The server only stores and retrieves — it **never calculates** (it validates input shape on save as a safety net only). The one piece of business-rule enforcement it does perform — rejecting a presence edit that overlaps a **snapshot-less paid bill's** period (§7) — is a *validation guard*, not a calculation: it still never sums days or splits an amount. (A paid bill with a snapshot is already frozen by that snapshot, so it imposes no such restriction.)

### 10.2 Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | **TypeScript** throughout | Catches money/date/schema bugs at write time; self-documenting for handoff; shared types across all layers. |
| Frontend | **React + Vite** (a static SPA, **prototype stage**) | Stateful calendar and live calculation suit React; Vite builds a plain static bundle (`dist/`). **Not Next.js** — no server rendering needed. The current UI/layout is a prototype and will be redesigned; the data/API contract it speaks is settled. |
| Calculation | **Plain TypeScript in the browser** (`src/calc.ts`) | The auditable heart of the app; owned in-repo, no library. |
| Calendar/date | **Hand-rolled** calendar + native `Date` interval helpers | Date logic and multi-range selection are written in-repo (`src/Calendar.tsx`, `src/calc.ts`) with no date library currently installed. *(The original plan named `date-fns` + a picker; not yet a dependency — see flag below.)* |
| Export | **Plain CSV**, generated client-side (no library) | Writes the final, already-computed numbers (one table per cycle) to a `.csv` in the browser — `src/export.ts`. No `xlsx`/SheetJS dependency and no live formulas; the numbers match the screen exactly. |
| API | **Cloudflare Worker** (thin storage API, hand-routed, no framework) | Receives saves/reads under `/api`, validates input, writes/returns JSON. No rendering, no calculation. |
| Database | **Cloudflare D1 (SQLite)** | Data is relational (houses → members → presence/bills); D1 queries this naturally where KV would force hand-rolled JSON blobs. Supports migrations for schema versioning. |
| Hosting | **A single Cloudflare Worker** serving both the static site and the API, plus D1, one account | One Worker, one origin: it serves the Vite build via a static-assets binding *and* the `/api` routes. Static asset serving is free; only API calls count against limits. |

#### Unified-Worker architecture (revised from the original Pages design)

The original blueprint described a **Cloudflare Pages** frontend plus a **separate** API Worker. That has been deliberately revised: the app is now **one Cloudflare Worker that serves both the static frontend and the API from the same origin.** Cloudflare's platform changed since the blueprint was first written — Workers can now serve static assets directly, and Cloudflare recommends Workers over Pages for new projects — so the two-service split is no longer needed.

How it works in code (`worker/index.ts` + `wrangler.toml`):

- `wrangler.toml` declares a static-assets binding (`[assets]`, `directory = "./dist/"`, `binding = "ASSETS"`) with `not_found_handling = "single-page-application"`.
- The Worker routes by path prefix: anything under **`/api`** is handled by the storage API (e.g. `/api/house/:id`, `/api/house/:id/member/...`); **every other path** is served from the static-assets binding, with SPA fallback to `index.html` so client-side React routes resolve. The `/api` namespace guarantees API paths can never collide with front-end routes.
- **CORS is now moot** — frontend and API share one origin, so cross-origin requests don't arise. The CORS headers/preflight handling remain in the Worker (harmless, and still correct if the API is ever called from another origin during local dev via `VITE_API_BASE`).

### 10.3 Abuse protection

Mostly configuration, not code:

- **Rate limiting** is implemented via Cloudflare's **Workers Rate Limiting binding** (`RATE_LIMITER`), declared in `wrangler.toml` as `[[ratelimits]]` with `simple = { limit = 65, period = 60 }` — i.e. **65 requests per 60 seconds**, keyed **per house** (the limiter key is the `house_id`) so one noisy house can never starve another. It covers every per-house read and write; house creation (which has no house ID yet) is intentionally not throttled. A throttled request gets HTTP **429** with a `Retry-After`. (The binding may be absent in some local-dev setups, so the Worker guards each call with `if (env.RATE_LIMITER)`.)
- **Valid-room-ID required before any write** — requests to a non-existent house are rejected (404).
- **Input validation in the Worker** on every write.
- **Default DDoS protection** from the platform, plus a usage alert as backstop.

---

## 11. Tools & setup

### 11.1 Toolchain
- **Node.js** (current LTS) — runs the build tooling.
- **npm** — package manager (bundled with Node).
- **Vite + React + TypeScript** — scaffolded in one command:
  ```
  npm create vite@latest kongsi-bill -- --template react-ts
  ```
- **Wrangler** — Cloudflare CLI for developing/deploying the Worker and managing D1 (tables, migrations, data).

### 11.2 Libraries
- Runtime dependencies are currently just **React** and **React DOM**; the toolchain (Vite, TypeScript, ESLint, Wrangler) is in devDependencies.
- The calculation, the calendar, and all date/interval logic are **hand-written TypeScript — no library.**
- **Export** is shipped as **plain CSV generated in-browser** (`src/export.ts`) — there is **no `xlsx`/SheetJS dependency**, and the earlier "XLSX with live formulas" plan was deliberately dropped in favour of a dependency-free CSV of final numbers.
- *Planned but not installed:* `date-fns` (or similar) and a date-range picker. These are referenced as the intended approach but are not current dependencies.

### 11.3 Accounts & environment
- **Cloudflare account** (free) — Workers (serving both static assets and the API), D1.
- **GitHub account** (free) — hosts the repo (also the formula source-of-truth). Deployment is **auto-deploy from GitHub via Cloudflare's Git integration**: on push, Cloudflare runs the build (`npm run build`) and then `npx wrangler deploy`, which uploads the Vite `dist/` output via the static-assets binding and publishes the Worker.
- **VS Code** (free) — editor with built-in TypeScript support.
- **Git** — version control and the deploy trigger.

### 11.4 Optional
- ESLint + Prettier (basic ESLint ships with the template).
- *Custom domain — declined; the free `*.workers.dev` subdomain is used.*

### 11.5 Not required
No database server to install, no Docker, no backend framework, no auth library, no state-management library, no CSS framework. Everything except Node lives inside the project via npm, keeping the machine clean and the project self-contained.

---

## 12. Cost & maintenance

### 12.1 Cost

| Usage level | Monthly cost |
|-------------|--------------|
| Low (your house + a few others) | **$0**, indefinitely. |
| Growing (dozens–hundreds of houses) | **$0** — workload is a few writes per billing cycle per house. |
| Large (thousands of active houses, or 100K Worker requests/day) | Flat **$5/month** Workers Paid — predictable, not usage-billed shock. |

Cloudflare's free tier **stops rather than bills** when limits are hit, so a surprise invoice is structurally impossible at this scale. Static asset serving (every app load) is free and unlimited; only save/read API calls count toward limits, and those sit far inside the free allowance (Workers free tier: 100,000 requests/day; D1 free tier: 5 GB storage, ample daily read/write rows). The entire dataset for many houses over years is megabytes.

### 12.2 Maintenance you are signing up for

- Occasional dependency updates (a few times a year).
- **Schema-migration work** when the stored data shape changes (an afternoon each time; mitigated by `schema_version` from day one).
- Managing/regenerating codes if one leaks.
- One-time setup of rate limiting and a usage alert.

This is a bounded, intermittent load — not an always-on liability.

---

## 13. v1 scope vs. later

**The lean core path (as built):**
create house → save codes → add members → member join link → calendar presence entry → **create a cycle → add that period's bills into it → Calculate the cycle → validate → optional rounding → settle (mark bills paid, freeze each split's snapshot, finalize the cycle into History)** → view history → export (latest cycle & full history, as CSV).

Plus the essential safety/UX: save-codes flow, actionable flags, show-the-working, preview-before-confirm, soft-remove, regenerate code.

> *Superseded since the original v1 plan:* the old "confirm → grace → lock" step and the `change_log`/audit trail were dropped — the lifecycle is simply **draft → paid**, the freeze is a per-bill **snapshot** (§7), and nothing is logged. Bills are grouped into explicit **cycles** (§6.8), and export ships as **CSV**, not XLSX.

**Hold for later (v2), add only if real use justifies:**
default-to-present calendar, copy-last-period, the house info card polish, and — explicitly parked — PDF bill auto-fill (it needs a backend that does work and per-use cost, breaking the no-backend simplicity; worth it mainly for combined multi-utility bills, and only as an opt-in, always-verify, best-effort feature).

The discipline: ship the lean core, use it for a real bill or two, then add comfort features where the friction actually proves to be — not before.

---

## 14. Open questions for the build stage

- None blocking. The data model field names and the exact date-picker library are the two things to finalise in code; both are low-risk and decided in passing during the build.

---

## 15. Repository & audit commitment

The repository is also the formula's source of truth. The README will state the formula, the assumptions (§3.3), and the worked example (§3.2) so that if the app ever produces a questionable result, anyone can reproduce it by hand. This satisfies the transparency priority and is the reason the calculation lives as owned, readable code rather than inside a library.

---

*End of blueprint.*
