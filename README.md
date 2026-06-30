# Kongsi Bill

*A fair way to split shared utility bills, based on who was actually home.*

Kongsi Bill splits household bills — electricity, water, gas, whatever — between housemates based on how many days each person was actually around during that bill's period. One person runs the show (the **person-in-charge**, or **PIC**): they punch in the bills, everyone marks the days they were home, and the app works out who owes what. The maths is shown openly, so anyone can double-check it by hand.

> **"Kongsi"** is Malay for *sharing something within a group* — which is pretty much the whole point. The app is built with Singapore and Malaysia housemates in mind.

**Last updated:** 30 June 2026 · *The frontend is at prototype stage (the UI will be redesigned). The calculation, data model, Worker API, architecture, and deployment described below are settled.*

---

## Documentation

- **[DOCUMENTATION.md](DOCUMENTATION.md)** — the full guide: how to use the app, being the PIC, multi-house, troubleshooting/FAQ, and the maths in plain language. *(Living document — kept up to date as questions come up.)*
- **[docs/blueprint.md](docs/blueprint.md)** — the design & build reference: data model, architecture, scope decisions.
- **This README** — what the app is, the formula (the audit source-of-truth), and how to get the project running.

---

## What's in here

- [The problem it solves](#the-problem-it-solves)
- [How it works, quickly](#how-it-works-quickly)
- [The maths (audit source-of-truth)](#the-maths-audit-source-of-truth)
  - [The basic idea](#the-basic-idea)
  - [What the app does, step by step](#what-the-app-does-step-by-step)
  - [The rules we're assuming](#the-rules-were-assuming)
  - [Tricky situations](#tricky-situations)
  - [Rounding (optional)](#rounding-optional)
  - [A full worked example](#a-full-worked-example)
  - [Check it yourself by hand](#check-it-yourself-by-hand)
- [What it's built with](#what-its-built-with)
- [Project layout](#project-layout)
- [Running it locally](#running-it-locally)
- [Putting it online](#putting-it-online)
- [What it costs to run](#what-it-costs-to-run)
- [Our promise on the maths](#our-promise-on-the-maths)

---

## The problem it solves

When you rent a place and the bills aren't included, someone has to figure out who pays what every time a bill lands. Splitting it equally isn't fair, because:

- People move in and out, so the headcount keeps changing.
- People go away a lot — trips, work, staying at family — so it's unfair to charge someone full price for a month they were barely there.
- Electricity, water, and gas all arrive on different dates, for different amounts, covering different stretches of time. Each one has to be worked out on its own.
- Doing all this by hand or in a spreadsheet is fiddly and easy to get wrong — and it really falls apart when the job gets passed to someone who isn't a spreadsheet person.

Kongsi Bill takes that spreadsheet off your hands, keeps a shared history for the house, and costs basically nothing to run.

> **How to actually use it** — setting up a house, joining, being the PIC, multiple houses, troubleshooting — all lives in **[DOCUMENTATION.md](DOCUMENTATION.md)**.

---

## How it works, quickly

1. Someone sets up a **house** and gets a room ID and two codes.
2. **Housemates** tap a link to join, and mark the days they were home on a calendar.
3. The person in charge creates a named **billing period** (e.g. "June 2026") and enters that period's **bills** into it — what each is for, how much, and the dates it covers.
4. The app works out each person's share based on the days they were home **during that bill's dates**, and shows its working. **"Calculate" runs over one billing period at a time** — combining that period's bills into a single per-person total — never across periods.
5. A bill stays **open** (editable) with no time limit. When the billing period is settled, the PIC calculates and settles it: each bill's split is **frozen as a saved snapshot**, the period is marked **finalized**, and it moves to a **History** view. A frozen split can't change afterwards, even if someone edits days or moves out.
6. You can export the records as a **CSV file** — the final numbers, ready to open in any spreadsheet. ("Export latest" gives the newest billing period's bills; "full history" gives every period.)

---

## The maths (audit source-of-truth)

This is the **official, authoritative definition of how the split is calculated.** It's kept here in the README on purpose: if the app ever produces a questionable number, anyone can reproduce it by hand using only what's written below. (A plain-language version for users also appears in [DOCUMENTATION.md](DOCUMENTATION.md), but *this* is the reference.)

### The basic idea

Each bill is split based on **how many days each person was home during that bill's dates**. If you were home twice as many days as your housemate, you pay twice as much.

For one bill:

```
your days        = how many days YOU were home during this bill's dates
everyone's days  = add up everybody's days for this bill
your share       = (your days ÷ everyone's days) × the bill amount
```

Your final total is your shares from every bill added together:

```
your final total = your electricity share + your water share + ...etc
```

Every bill is worked out separately. Your "days home" for electricity and for water will usually differ, because the two bills cover different date ranges.

### What the app does, step by step

For each bill:

1. **Gather everyone's days.** Each person's time at home is stored as date ranges — like `5 May – 10 May` and `14 May – 20 May`. People can have several ranges to cover times they were away in between.
2. **Tidy up overlaps.** Overlapping ranges (say `1–10 May` and `5–15 May`) are merged into one (`1–15 May`) so nobody is counted twice.
3. **Trim to the bill's dates.** Each person's days are cut to only those inside this bill's period. Days outside it don't count toward this bill.
4. **Count the days.** A day counts if the person was there at any point that day — see [the rules](#the-rules-were-assuming).
5. **Add up the total.** Sum everyone's day counts — that's what you divide by.
6. **Work out each share.** `(person's days ÷ total days) × bill amount`.
7. **Sanity-check.** The shares should add back to the bill amount.
8. **Round, if asked.** Only at the very end, on each final total — never partway through.

### The rules we're assuming

Intentional simplifications — part of the model, not bugs:

1. **Whole days only.** Present at any point in a day = that whole day counts. No half-days. Arrival and departure days both count in full.
2. **We count days, not usage.** Someone running the air-con all day is charged the same per day as someone who just sleeps there. Actual usage isn't tracked — there's no fair way to measure it, and counting days is something everyone can verify.
3. **Each bill stands alone.** Bills never share day counts.
4. **Dates are just dates.** No clock times, no timezones. `5 May` means the calendar day, the same for everyone.

### Tricky situations

- **Days outside a bill's dates** simply don't count toward it. Recording dates that belong to no bill does no harm.
- **Someone away the whole period** has a day count of `0`, so their share is **$0.00** — correct, not a glitch.
- **Nobody home (or no days entered):** everyone's total is `0`, so there's nothing to divide by. The app **flags it** instead of breaking, and explains the likely cause.
- **Double-entered days** are handled by the overlap merge in step 2 — you can't be charged twice for one day.
- **Totals not adding up:** the app checks the shares sum back to the bill amount (allowing tiny rounding wobbles) and flags any mismatch in plain language.

### Rounding (optional)

Off by default. When the PIC turns it on, they pick a direction:

- **Round down** to the nearest 5 cents → the house collects **a little less**; someone covers the gap.
- **Round up** to the nearest 5 cents → the house collects **a little more**; a small surplus.

Two rules:

- Rounding only touches the **final per-person totals**, after everything else — never the middle numbers.
- The leftover (**remainder**) is **shown to the PIC, not assigned automatically.**

```
leftover = bill amount − (everyone's rounded shares added up)
```

Round down → you're short; round up → there's extra.

### A full worked example

**Electricity bill:** **$100.00**, covering **1 Jan – 31 Jan** (31 days).

| Person | When they were home          | Days |
|--------|------------------------------|------|
| Alice  | The whole month              | 31   |
| Bob    | 1 Jan – 15 Jan               | 15   |
| Carol  | All month, but away 10–19 Jan| 21   |

**Add up everyone's days:**

```
31 + 15 + 21 = 67
```

**Each share:**

| Person | The sum         | Share (to the cent) |
|--------|-----------------|---------------------|
| Alice  | 31 ÷ 67 × 100   | 46.27  |
| Bob    | 15 ÷ 67 × 100   | 22.39  |
| Carol  | 21 ÷ 67 × 100   | 31.34  |
| **Total** |              | **100.00** ✓ |

The **Share** column is each person's amount **rounded to the nearest cent**. The raw fractions are `46.2686…`, `22.3880…`, `31.3432…`; the app allocates the cents (handing any leftover cent to the largest fractional parts) so the displayed shares total **exactly** the bill amount. It adds back up to $100. ✓

**With rounding on (round down to 5 cents):**

| Person | Exact share | Rounded down |
|--------|-------------|--------------|
| Alice  | 46.2686…    | 46.25        |
| Bob    | 22.3880…    | 22.35        |
| Carol  | 31.3432…    | 31.30        |
| **Total** |          | **99.90**    |

```
leftover = 100.00 − 99.90 = 0.10   (the house is 10 cents short — someone covers it)
```

That 10 cents is shown to the PIC to deal with; the app doesn't assign it on its own. Water and any other bill work the same way, each with its own dates, days, and amount.

### Check it yourself by hand

1. For each person, write down the days they were home, then **cross out any outside the bill's dates**.
2. **Count** what's left (merge overlaps first).
3. **Add** all the counts together — that's your total.
4. For each person: `(their days ÷ the total) × the bill amount`.
5. **Add up** all the shares — they should come to the bill amount (before rounding), give or take a cent.
6. If rounding was on, round each total down/up to the nearest 5 cents, then work out the leftover.

If your answer doesn't match the app's, **the app is wrong** — please open an issue with your numbers.

---

## What it's built with

| Part         | What we use                                   | Why                                                          |
|--------------|-----------------------------------------------|-------------------------------------------------------------|
| Language     | **TypeScript** everywhere                     | Catches money and date mistakes early; shared types.        |
| Frontend     | **React + Vite** (a static site, *prototype stage*) | Good for the interactive calendar and live maths; builds to static files. The UI is a prototype and will be redesigned. |
| The maths    | **Plain TypeScript, in your browser**         | The bit everyone audits — simple, in-house, no library.     |
| Calendar     | **Hand-written** (plain TypeScript + native dates) | Date logic and multi-range selection, written in-repo — no date library is installed yet. |
| Export       | **Plain CSV**, generated in the browser       | A `.csv` of the final, already-computed numbers (one table per billing period) — opens in any spreadsheet. No `xlsx`/SheetJS dependency and no live formulas; the numbers are the same ones shown on screen. |
| The API      | **Cloudflare Worker** (just for storage)      | Saves and fetches data under `/api`. Does none of the maths. |
| Database     | **Cloudflare D1** (SQLite)                     | Stores houses, members, days, and bills.                    |
| Hosting      | **A single Cloudflare Worker** (serves the site *and* the API) + D1 | One Worker serves the static build and the API from one origin; serving the site is free and unlimited. |

**The guiding idea:** your browser does all the maths and everything you see; the server just remembers your data between visits. The calculation even works if the server's down.

**One Worker, one origin.** The frontend and the API are served by the *same* Cloudflare Worker: anything under `/api` is the storage API, and every other path serves the static React app (with single-page-app fallback). Cloudflare can now serve static sites straight from a Worker and recommends Workers over Pages for new projects, so there's no separate Pages site. (Because everything is one origin, CORS no longer matters — the handling is still in the Worker but is effectively a no-op.)

> **On purpose, we *don't* use:** Next.js, any login/account system, an always-on database server, or a CSS framework. Leaving these out keeps the whole thing lean and easy to look after. (Full reasoning in [docs/blueprint.md](docs/blueprint.md).)

---

## Project layout

> Reflects the current layout; the frontend (`src/`) is prototype-stage and will be reorganised when the UI is redesigned.

```
kongsi-bill/
├── README.md                 ← you're reading it (the maths source-of-truth)
├── DOCUMENTATION.md          ← the full usage guide (living document)
├── docs/
│   └── blueprint.md          ← the design reference
├── wrangler.toml             ← Worker config: static-assets binding, D1, rate limiter
├── src/                      ← the React frontend (prototype)
│   ├── calc.ts               ← the calculation: day-weighted split, rounding, reconciliation
│   ├── api.ts                ← the only place the frontend calls the /api Worker
│   ├── store.tsx             ← app state + actions (React context)
│   ├── types.ts              ← shared TypeScript types (mirror the Worker JSON contract)
│   ├── Calendar.tsx, clipboard.ts, …  ← UI building blocks
│   └── screens/              ← the screens (admin + member flows)
├── worker/
│   └── index.ts              ← the single Cloudflare Worker (serves static site + /api)
├── migrations/               ← D1 schema: 0001_init, 0002_drop_lock, 0003_confirm_and_paid, 0004_paid_snapshot, 0005_cycles
└── package.json
```

---

## Running it locally

**You'll need:** [Node.js](https://nodejs.org) (current LTS) and a free [Cloudflare account](https://dash.cloudflare.com/sign-up). Wrangler comes in as a dev dependency, so `npx wrangler` works after `npm install`.

```bash
# 1. Install dependencies
npm install

# 2. Fast UI loop — Vite dev server (frontend only, no API)
npm run dev

# 3. The real thing — one Worker serving the built site + the /api routes + D1
npm run build                  # tsc + vite build → dist/
npx wrangler dev               # serves dist/ via the assets binding AND the API

# First-time database setup (once):
npx wrangler login
npx wrangler d1 create kongsi-bill   # then apply migrations/ with `wrangler d1 migrations apply`
```

> Running `npm run dev` alone gives you the UI with **no backend** — there's no offline/demo mode, so the app opens to a blank empty house and any save/load call fails until a Worker is serving `/api`. To exercise the live `/api` contract and D1, use `npx wrangler dev` against the built `dist/`. If you ever need the Vite dev server to talk to a *remote* Worker, point `VITE_API_BASE` at it; otherwise the frontend calls `/api` on its own origin.

---

## Putting it online

The repo is connected to Cloudflare through its **GitHub (Git) integration**, which rebuilds and redeploys automatically on every push to the main branch.

- On push, Cloudflare runs the build (`npm run build`) and then `npx wrangler deploy`.
- `wrangler deploy` publishes the **single Worker** and uploads the Vite `dist/` output via the static-assets binding — so one deploy ships **both** the site and the API.
- **Database** → Cloudflare D1, with schema changes applied through `migrations/`.

The site runs on the free `*.workers.dev` address — live at **`https://kongsi-bill.app-my.workers.dev`**. (No custom domain — not needed.) Join links are built same-origin from wherever the app is served (relative `/join?house=…&code=…`), so they always point at the right place.

---

## What it costs to run

Realistically, **$0 a month.** The app does a handful of saves and reads per billing period per house, well inside Cloudflare's free limits. Loading the app is always free and unlimited; only save/fetch calls count, and they're nowhere near the cap. On the free tier Cloudflare just **stops** at a limit rather than billing you, so a surprise charge basically can't happen at this size. You'd only reach the flat $5/month plan with thousands of active houses.

Upkeep is light and occasional: dependency updates a few times a year; a little work if the stored-data shape ever changes (made easier by versioning it from day one); regenerating a code if one leaks; and a usage alert as a backstop. Rate limiting is already in place — Cloudflare's Workers Rate Limiting binding (`RATE_LIMITER` in `wrangler.toml`), set to 65 requests per 60 seconds per house, returning a `429` when exceeded.

---

## Our promise on the maths

This repo is the **official home of the formula.** The explanation, assumptions, and worked example above are written so you can redo any result by hand. The calculation lives as plain, readable TypeScript in `src/calc.ts` — not buried in a library — so anyone can open it and check it. If the app ever gives you a number you can't match using [Check it yourself by hand](#check-it-yourself-by-hand), that's a bug — please open an issue with the numbers.

---

*Kongsi Bill — share the bill, fairly.*