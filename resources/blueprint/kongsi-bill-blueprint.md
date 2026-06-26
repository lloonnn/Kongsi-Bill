# Kongsi Bill — Project Blueprint

*A day-weighted utility bill splitter for shared households.*

**Document status:** v1 design, locked. This is the single source of truth for what Kongsi Bill is, what it does, and how it is built. It is the brief for the build, the seed for the repository README, and the reference for the UI/UX design stage.

**Last updated:** 24 June 2026

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

| Person | Calculation        | Raw share |
|--------|--------------------|-----------|
| Alice  | 31 / 67 × 100      | 46.27     |
| Bob    | 15 / 67 × 100      | 22.39     |
| Carol  | 21 / 67 × 100      | 31.34     |
| **Sum**|                    | **100.00** ✓ |

The sum reconciles with the bill total. Water and any other utility are computed the same way, with their own periods and day counts.

### 3.3 Rules, assumptions & edge cases

- **Whole days only.** A day counts if the person was present at any point that day. No half-days.
- **Clip to the billing period.** A person's presence is always intersected with each bill's period; days outside the period never count toward that bill. A person may safely record dates that fall outside any bill — they simply count toward nothing.
- **Cost is proportional to days present.** Actual usage intensity (e.g. someone running air-conditioning all day) is *not* modelled. This is intentional, for legibility and because per-day usage cannot be verified. Documented as an explicit assumption.
- **Overlapping/duplicate ranges are merged.** If a person records 1–10 Jan and 5–15 Jan, the overlap is merged so days are not double-counted. (Automatic, because presence is stored as real dates.)
- **Zero-denominator guard.** If `total_person_days = 0` for a bill (nobody present in the period, or no data entered), the split is undefined and is **flagged**, not crashed.
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
| **Admin code** | The PIC only | Everything members can, plus add/edit bills, calculate, finalise, manage members, export, override locks. |

The codes *are* the access mechanism — there is no separate identity. This is the deliberate trade that removes authentication entirely. Its accepted limitations: the app cannot prove *which* member acted (no per-person accountability), and security depends on codes being kept within the house.

### 5.3 Entry paths

- **Members** use a **one-tap join link** with the member code embedded:
  `kongsibill.pages.dev/join?house=ABC123&code=XYZ`
  This drops them straight into their house's day-entry view with no typing. The link carries the keys, so it lives only in the house group chat.
- **Admins** use a separate **manage path** (`/manage`) and enter the admin code. The admin code is **never embedded in a link** — it stays typed and private.
- Asymmetry by design: member code travels in links (convenience); admin code never does (protection).

### 5.4 Code lifecycle

- **Leaked or departed-member concern:** regenerate the member code; this invalidates all old join links at once, and the admin sends a fresh link.
- **Lost codes:** accepted risk. With no accounts there is no recovery path; a lost admin code with no one holding it orphans the house. Mitigated by a prominent, hard-to-skip "save your codes" step at creation (copy-all, download, and an "I've saved these" confirmation).
- **PIC handoff:** transferring admin = sharing the admin code with the next PIC (optionally regenerating it so the old one stops working), surfaced as an explicit "hand over to new PIC" action plus a shareable house info card (room ID, join link, admin note).

### 5.5 The admin code in practice

A focused reference for whoever becomes PIC. The admin code is the master key for a single house and the only proof of PIC status (there are no accounts).

- **Powers it unlocks** (everything a member can do, plus): add/edit bills; calculate and finalise (confirming starts the 7-day grace, then lock); override a locked bill (logged to the change log); add/soft-remove members; export latest or full history; regenerate codes; hand over to the next PIC.
- **When used:** roughly once per bill (add bill → calculate → confirm), plus off-cycle housekeeping (member changes, a leaked code, fixing a locked bill).
- **How used — typed, never linked:** the admin reaches the manage path (`/manage`) and **types the admin code by hand each time**. Unlike the member code, it is never embedded in a link, because the member join link is pasted into the house group chat where it is visible. Typing keeps the admin code out of chat history and link previews. This is the deliberate asymmetry from §5.3.
- **Unrecoverable:** with no accounts there is no reset. A lost admin code with no holder orphans the house (members can still view, but no one can administer). This is why the save-codes step at creation (§5.4) is treated as the one critical, unskippable moment, and why handoff means deliberately passing the code on.

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
active            boolean   (false = soft-removed; stays attached to past bills)
schema_version    integer
```

### 6.3 Presence record (per member)
```
member_id         string
ranges            list of { start: date, end: date }   (multiple ranges; overlaps merged on save)
schema_version    integer
```
Each member owns their own presence record, so two members entering days touch different records and cannot overwrite each other.

### 6.4 Bill
```
bill_id           string
house_id          string
utility_label     string   (free text: "Electricity", "Water", "Gas", "Internet"…)
amount            number
period_start      date
period_end        date
status            enum     (draft | confirmed | locked)
confirmed_at      date     (starts the grace window)
schema_version    integer
```

### 6.5 Change log entry
```
log_id            string
house_id          string
timestamp         date
action            string   (what changed; includes admin overrides after lock)
detail            string
```

### 6.6 Date handling

- **Stored and computed** as plain calendar dates in `YYYY-MM-DD` — no time, no timezone.
- **Displayed** to users as `DD-MM-YYYY`.
- Mixing storage and display format this way is intentional and is how timezone/parsing bugs are avoided.

### 6.7 Soft-delete & lifecycle

- Departed housemates are **soft-removed** (`active = false`): they no longer appear in new bills but remain attached to past bills so history stays intact and totals still reconcile.
- Nothing is hard-deleted; records are marked inactive. The change log makes bad edits visible and recoverable.

---

## 7. Bill lifecycle (grace & lock)

1. **Draft** — admin adds/edits a bill freely.
2. **Confirmed** — admin confirms; a **7-day grace period** begins during which edits are still allowed. A reminder notice surfaces as the window closes.
3. **Locked** — after 7 days the bill locks. Members cannot edit it.
4. **Admin override** — even after lock, the **admin code** can force an edit; every override is written to the **change log** so it is visible. This keeps the lock meaningful for members while leaving an escape hatch for genuine corrections.

---

## 8. User flow

Three journeys plus lifecycle actions. (A visual flowchart of this exists alongside the blueprint.)

### Journey A — Admin sets up the house
1. Create house (first run, no data).
2. Receive room ID + two codes.
3. **Save codes** (copy/download, confirm saved) — the one unrecoverable step, given prominence.
4. Add housemates (variable count, no code edits).
5. Share the member join link into the house chat.

### Journey B — Member records presence
1. Open the one-tap join link → straight into the house.
2. Select days present on a calendar; add multiple date ranges to cover gaps when away.
3. Save own record (overlaps auto-merged).

*(Members can update presence any time before a bill is confirmed; the admin can also enter days on a member's behalf. B feeding into C is the typical path, not the only one.)*

### Journey C — Admin calculates & finalises
1. Add a bill (utility label, amount, billing period).
2. App computes shares from everyone's presence, clipped to the bill's period.
3. Validate — reconciliation and zero-denominator flags, with actionable messages.
4. Optional rounding toggle (down/up, off by default); remainder surfaced.
5. Confirm bill → starts the 7-day grace, then locks (admin can override, logged).

### View, export & lifecycle
- View history — a flat list of bills, each with its own period.
- Export — **latest** bill or **full history**, as XLSX with live formulas.
- Lifecycle — soft-remove a departed housemate; regenerate a leaked code; recover from a bad edit via the change log.

---

## 9. UX principles

Carried into the dedicated UI/UX stage; recorded here so they are not lost.

- **Default to "present the whole period."** Most housemates are home most of the time; let them subtract days away rather than build presence from nothing.
- **Live day-count** as days are selected ("You've marked 24 days present").
- **Copy last period's pattern** for recurring schedules. *(Comfort feature — v2.)*
- **Show the working**, not just the answer: display `Alice: 24/67 days × $100 = $35.82` so the on-screen result mirrors the audit principle.
- **Actionable flags:** a mismatch says what to do, not just that something's wrong.
- **Preview before confirm:** since confirm starts the lock, show a clear summary with confirm/cancel.
- **One-tap join link** to eliminate the most error-prone data entry.
- **Save-codes as the path of least resistance:** copy-all, download, "I've saved these" gate.
- **House info card** for clean PIC handoff.
- **Confirmation toasts** on every save; **guiding empty states**; **mobile-first** throughout; **plain-language labels** ("who pays what", "billing period") for a non-technical PIC.

---

## 10. Architecture & tech stack

### 10.1 Guiding principle

Push as much as possible into static files and the browser; keep the server doing the minimum. The app is fundamentally arithmetic plus a little storage, so the core logic is client-side, instant, free to run, and works even if the backend is down. The server only stores and retrieves — it never calculates (it re-validates on save as a safety net only).

### 10.2 Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | **TypeScript** throughout | Catches money/date/schema bugs at write time; self-documenting for handoff; shared types across all layers. |
| Frontend | **React + Vite** | Stateful calendar and live calculation suit React; Vite builds a plain static bundle. **Not Next.js** — no server rendering needed; Next.js would add complexity only to suppress it. |
| Calculation | **Plain TypeScript in the browser** | The auditable heart of the app; owned in-repo, no library. |
| Calendar/date | **date-fns** + a lightweight React date-range picker | Lean interval logic and multi-range selection without a heavy calendar suite. |
| Export | **SheetJS (`xlsx`)**, client-side | Writes XLSX with live formulas; server never touches it. |
| API | **Cloudflare Workers** (thin storage API) | Receives saves/reads, validates, writes/returns. No rendering, no calculation. |
| Database | **Cloudflare D1 (SQLite)** | Data is relational (houses → members → presence/bills); D1 queries this naturally where KV would force hand-rolled JSON blobs. Supports migrations for schema versioning. |
| Hosting | **Cloudflare Pages** (frontend) + Workers + D1, one account | Static assets served free and unlimited; only save/read calls count against limits. |

### 10.3 Abuse protection

Mostly configuration, not code: rate limiting on the Worker route; valid-room-ID required before any write (writes to non-existent houses rejected); input validation in the Worker; default DDoS protection; a usage alert as backstop.

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

### 11.2 Libraries (added to the project)
- `date-fns` and a lightweight React date-range picker.
- `xlsx` (SheetJS).
- *(The calculation logic is hand-written TypeScript — no library.)*

### 11.3 Accounts & environment
- **Cloudflare account** (free) — Pages, Workers, D1.
- **GitHub account** (free) — hosts the repo (also the formula source-of-truth); Cloudflare Pages auto-deploys on push.
- **VS Code** (free) — editor with built-in TypeScript support.
- **Git** — version control and the deploy trigger.

### 11.4 Optional
- ESLint + Prettier (basic ESLint ships with the template).
- *Custom domain — declined; the free `.pages.dev` subdomain is used.*

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

**Build v1 (the lean core path first):**
create house → save codes → add members → member join link → calendar presence entry → add bill → calculate → validate → optional rounding → confirm/grace/lock → view history → export (latest & full).

Plus the essential safety/UX: save-codes flow, actionable flags, show-the-working, preview-before-confirm, soft-remove, change log, regenerate code.

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
