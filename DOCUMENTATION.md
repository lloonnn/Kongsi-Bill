# Kongsi Bill — Documentation

*The complete guide to using and understanding Kongsi Bill. This is a living document — it will be updated as questions come up and things need clarifying.*

**Last updated:** 27 June 2026

> New here? Start with [Quick start](#quick-start). Running a house? See [Being the PIC](#being-the-pic). Just need to enter your days? See [For housemates](#for-housemates).

---

## Contents

**Using the app**
- [Quick start](#quick-start)
- [Key ideas in plain terms](#key-ideas-in-plain-terms)
- [For housemates](#for-housemates)
- [Being the PIC](#being-the-pic)
- [Codes, links, and getting in](#codes-links-and-getting-in)
- [Being in more than one house](#being-in-more-than-one-house)
- [The life of a bill](#the-life-of-a-bill)
- [When people move in or out](#when-people-move-in-or-out)
- [Exporting your records](#exporting-your-records)
- [Troubleshooting & FAQ](#troubleshooting--faq)

**Under the hood**
- [The maths in full](#the-maths-in-full)
- [Data & privacy](#data--privacy)
- [What's deliberately left out](#whats-deliberately-left-out)

---

# Using the app

## Quick start

**If you're setting up the house (you'll be the PIC):**
1. Create a house. You'll get a **room ID** and **two codes** (a member code and an admin code).
2. **Save those codes somewhere safe right away** — there's no way to recover them later. This is the one step you can't skip.
3. Add your housemates (add yourself too if you share the bills — you're prompted to, but it's optional).
4. Share the **join link** into your house group chat so everyone can join.
5. When a bill arrives, enter it and let the app calculate. It stays **open** (editable) for as long as you like; when everyone's paid up, mark it **paid** to settle and close it.

**If you're a housemate joining:**
1. Tap the **join link** someone shared in the group chat.
2. Mark the days you were home on the calendar.
3. Save. That's it — you'll be able to see how each bill gets split.

---

## Key ideas in plain terms

- **House** — your shared place. Everything (members, bills, history) lives inside one house, and houses can't see each other.
- **PIC (person-in-charge)** — the one person who runs the bills. The role can be handed over to someone else later.
- **Member / housemate** — everyone in the house who marks their own days.
- **Room ID** — the house's "address." Says *which* house, not secret on its own.
- **Member code** — the everyday key. Lets you join and mark your days.
- **Admin code** — the master key. Only the PIC holds it; it unlocks running the bills.
- **Bill** — one utility charge (electricity, water, gas…) with an amount and a date range.
- **Billing period** — the dates a bill covers. Your share depends on how many of those days you were home.

A simple way to hold it: the **room ID is the address**, and the **two codes are keys** — a normal key everyone gets, and a master key just for the PIC.

---

## For housemates

Your job is simple: tell the app which days you were home.

1. **Tap the join link** from your group chat. It takes you straight into your house — no typing, no password.
2. **Mark your days on the calendar.** Pick the stretches you were home. You can add **several separate ranges** if you were away in between — for example, home the 1st–10th, away for a trip, then home again the 14th–20th. Add as many ranges as you need.
3. **Save.** If your ranges happen to overlap, the app tidies them up automatically so you're never counted twice.

A few things to know:
- You can **update your days any time while the bill covering them is still open.** Once a bill is marked **paid** (settled), the days inside its period are frozen — the app will refuse an edit that overlaps a paid bill's dates, so a settled split can't be quietly changed.
- **If you don't mark any days at all, you're counted as present for the whole period** — you still get a fair share rather than being dropped to zero. Mark your days only to record the times you were *away*.
- You only ever edit **your own** days. You can see everyone's splits, but you mark only yourself.
- If you recorded days and were away the **whole** period of a bill, your share for that bill is **$0** — that's correct, not a mistake.
- There's an optional **"my days are correct"** tick you can set once you've reviewed your days, so the PIC can see who's ready. It clears itself automatically if you edit your days again.
- The PIC can also enter days on your behalf if you're slow to do it.

---

## Being the PIC

If you're the person-in-charge, the **admin code is your master key.** The member code lets everyone do the everyday stuff; the admin code unlocks everything that affects the house's money and records. Only one person should hold it at a time — you.

### What the admin code lets you do

Everything a housemate can do, plus the bits that count:
- **Add and edit bills** — enter a new bill with its amount and dates, or fix one. An open bill stays editable as long as you need; there's no countdown.
- **Calculate the split** — work out everyone's share from the days they were home.
- **Mark a bill paid (settle it)** — when the money's in and you've paid the landlord, mark the bill paid. This **closes** it and freezes the days inside its period, so the settled split can't change afterwards.
- **Delete a mistaken bill** — remove a bill you added by accident. (People are never deleted — only bills.)
- **Manage housemates** — add someone new, or remove someone who moved out (removal is one-way; they stay attached to past bills).
- **Export** — download the latest bill or the full history as a spreadsheet.
- **Regenerate the member code** — if it leaks, make a fresh one (this cancels all old join links).
- **Hand over to the next PIC** — pass the role on by giving them the admin code.

In short: housemates *put in their days and look*; you *run the bills*.

### When you'll use it

Usually about once per bill, plus the odd bit of housekeeping:
1. A bill arrives in real life.
2. You open the manage page, type the admin code, and add the bill.
3. Everyone's marked their days (or you nudge them).
4. You calculate, check the working, optionally turn on rounding.
5. Once everyone's settled up, you mark the bill **paid** to close it.
6. Done until the next bill — unless someone moves in/out or a code leaks.

### How you actually use it — typed, never in a link

This is the key difference from how housemates get in: **the admin code is never put in a link.** Housemates join through a one-tap link with the member code baked in — but that link gets pasted into the group chat, where anyone could see it. The admin code must never travel that way.

So instead:
1. Go to the **manage page** (`…/manage`).
2. **Type the admin code** by hand.
3. You're in as PIC — do what you came to do.
4. Leave.

You type it each time. That keeps it out of chat histories and link previews — which is the whole point.

### Look after it — this one can't be recovered

There are no accounts and no passwords, so **the admin code is the only proof you're the PIC, and there's no way to get it back if it's lost.** If you lose it and nobody else has a copy, the house can't be run anymore — people can still *view* as housemates, but no one can add or settle bills, or manage members.

- **Save it somewhere safe** at setup — a password manager, or a note you trust.
- **Never paste it anywhere public** — not the group chat, not a screenshot, not a link.
- **When handing over**, give the next PIC the admin code directly — and regenerate it first if you want your old copy to stop working.

---

## Codes, links, and getting in

There are two codes and one address. Here's exactly how each is used.

| Thing | What it is | How it's used |
|-------|-----------|---------------|
| **Room ID** | The house's address | Identifies which house; sits inside the join link. Not a secret by itself. |
| **Member code** | The everyday key | Baked into the join link so housemates get in with one tap. |
| **Admin code** | The master key | Typed by hand on the manage page. **Never** put in a link. |

**The member join link** looks like:
```
…/join?house=<ROOM_ID>&code=<MEMBER_CODE>
```
It bundles the address and the everyday key together, which is why one tap is enough. Keep it to the house group chat.

**The asymmetry, on purpose:** the member code travels in links (convenience); the admin code never does (protection). Members get the easy door; the PIC's master key stays private.

**If a code leaks or someone leaves:** the PIC regenerates the member code. This instantly cancels every old join link, and the PIC shares a fresh one. (See [When people move in or out](#when-people-move-in-or-out).)

---

## Being in more than one house

You can belong to several houses — say you're the PIC of your own place and also a housemate somewhere else. Here's how that works.

### Each house has its own link and codes

Houses are completely separate, each with its own room ID and codes. So **if you're in two houses, you have two join links — one per house.** There's no single combined link; they're different doors to different houses.

### The link is a reusable door, not a one-time ticket

The same join link you first joined with is what you **tap again** whenever you want to come back to that house. It lives in that house's group chat, so it's always there. Tapping it always lands you in that house.

So to switch between houses, you just tap the link for whichever house you want right now. Each house's link sits in its own group chat. **Nothing extra to remember or store** — the links are the switching mechanism.

> **Current behaviour (v1):** the app opens whichever link you most recently tapped ("last house wins"). To switch back, tap the other house's link again. A saved "your houses" list that lets you switch without re-tapping is a possible future addition, not in v1.

### Your role is per-house, not global

This is the important part: **your role isn't something you carry around — it belongs to the code you used to enter a given house.** There's no global "this person is an admin" status.

So if you're the **PIC in House A** but an **ordinary housemate in House B**:
- For **House A**, you go to its manage page and type House A's **admin code** → you're an admin *in House A*.
- For **House B**, you tap House B's **member link** → you're a regular housemate *in House B*.

The two never interfere. Being admin in House A gives you no extra power in House B, because House B only recognises its own codes. Your "admin-ness" simply doesn't travel between houses — it's earned per-house by holding that house's admin code. Entering different codes for different houses is completely fine and **never mixes data**; each code only ever opens its own house.

### One thing to expect: two kinds of re-entry

Because the admin code is never in a link, your two houses feel slightly different to get back into:
- **The house where you're a member:** tap the saved link in the group chat. One tap.
- **The house where you're the PIC:** open the manage page and type the admin code. A bit more deliberate.

That's the convenience-for-members, protection-for-admins design working as intended — just expect the PIC house to take an extra step.

---

## The life of a bill

A bill has just two states: **Open**, then **Closed**.

1. **Open** — the bill is live and fully editable. The PIC can change its amount, label, or dates, and housemates can keep marking their days. **There's no time limit** — a bill stays open for as long as you want; nothing locks it automatically.
2. **Closed (paid)** — when the cycle's settled, the PIC marks the bill **paid**. That's the lock: the bill freezes, and the days inside its period can no longer be changed. If anyone tries to edit days that overlap a paid bill's dates, the app refuses the change. This is enforced by the server, not just hidden in the screen — so a settled split genuinely can't shift afterwards.

That's the whole lifecycle. There's no grace period, no countdown to a lock, and no "admin override" — while a bill is open it's simply editable, and marking it paid is the single, deliberate step that settles it. (Nothing is logged or audit-trailed; the freeze is the protection.)

---

## When people move in or out

- **Someone moves in:** the PIC adds them as a housemate; they join with the link and start marking days. They only affect bills from then on.
- **Someone moves out:** the PIC **soft-removes** them. They disappear from new bills but **stay attached to past bills**, so old splits still add up correctly. Nothing is ever truly deleted.
- **Worried about a leaver still having the link?** Regenerate the member code. Every old link stops working at once, and the PIC shares a fresh one with the people still in the house.

---

## Exporting your records

You can download your house's records as a spreadsheet, in two flavours:
- **Latest** — just the most recent bill's split.
- **Full history** — every bill on record.

The spreadsheet includes **live formulas**, not just final numbers — so anyone can open it, see the maths working itself out, change an input, and watch it recalculate. It's the same "check it yourself" principle, in spreadsheet form.

---

## Troubleshooting & FAQ

> This section will grow as real issues come up. If something here is unclear or wrong, that's exactly what this living document is for.

**"It says the split can't be calculated."**
Usually this means nobody's days fall inside the bill's dates — often the bill's date range doesn't match when people were actually home, or days haven't been entered yet. Check the bill's dates and that housemates have marked their days for that period.

**"My share is $0."**
You were marked as home for none of the days inside that bill's period (you were away the whole time, or joined later). That's correct behaviour.

**"The totals don't quite add up after rounding."**
That's expected — rounding leaves a small leftover on purpose, which the app shows to the PIC to deal with. See [Rounding](#rounding) below.

**"It won't let me change my days."**
The days you're trying to edit fall inside the period of a bill that's already been marked **paid**. Settled bills are frozen so the split can't change after the fact. If it's a genuine mistake, the PIC would need to reopen that bill (set it back to open) before the days can be edited.

**"I lost the admin code."**
There's no recovery if nobody holds it. The house can still be viewed but not run. This is why saving codes at setup matters — see [Being the PIC](#being-the-pic).

**"Someone left the house — how do I stop them getting in?"**
Regenerate the member code (PIC action). All old links stop working immediately.

**"I'm in two houses and it keeps switching."**
The app shows whichever house's link you tapped most recently. Tap the other house's link to switch back. See [Being in more than one house](#being-in-more-than-one-house).

---

# Under the hood

## The maths in full

This is the user-facing explanation of how the split is calculated. The **authoritative, audit-grade version lives in the project README** (it's the formula's official source of truth). This section says the same thing in everyday language.

### The basic idea

Each bill is split by **how many days each person was home during that bill's dates.** Home twice as many days as your housemate → you pay twice as much.

For one bill:
```
your days       = days YOU were home during this bill's dates
everyone's days = add up everybody's days for this bill
your share      = (your days ÷ everyone's days) × the bill amount
```
Your final total is your shares from every bill added together. Each bill is worked out on its own — your day count for electricity and for water will usually differ, because the two cover different date ranges.

### Step by step, per bill

1. **Gather everyone's days** (stored as date ranges).
2. **Merge overlaps** so no day is double-counted.
3. **Trim to the bill's dates** — only days inside the bill's period count.
4. **Count the days** — a day counts if you were there at any point that day.
5. **Add up everyone's days** — that's what you divide by.
6. **Work out each share** — `(person's days ÷ total) × amount`.
7. **Sanity-check** — the shares should add back to the bill amount.
8. **Round** (only if switched on) — applied at the very end, to final totals only.

### The rules we assume

1. **Whole days only** — present at any point in a day = the whole day counts. No half-days.
2. **Days, not usage** — we count days present, not how much electricity/water you personally used. There's no fair way to measure intensity, and days are something everyone can verify.
3. **Each bill stands alone** — bills never share day counts.
4. **Dates are just calendar dates** — no times, no timezones.

### Rounding

Off by default. If the PIC turns it on, they pick a direction:
- **Round down** to the nearest 5 cents → the house collects **slightly less**; someone covers the small gap.
- **Round up** to the nearest 5 cents → the house collects **slightly more**; small surplus.

The leftover is **shown to the PIC, never auto-assigned**:
```
leftover = bill amount − (everyone's rounded shares added up)
```

### Worked example

Electricity, **$100.00**, **1–31 Jan** (31 days). Alice home all 31; Bob home 1–15 (15); Carol home all month but away 10–19 (21).

```
total days = 31 + 15 + 21 = 67
Alice = 31 ÷ 67 × 100 = 46.27
Bob   = 15 ÷ 67 × 100 = 22.39
Carol = 21 ÷ 67 × 100 = 31.34
total = 100.00  ✓
```

With round-down-to-5-cents on: 46.25 + 22.35 + 31.30 = 99.90, leaving a 10-cent shortfall the PIC assigns.

### Check any result by hand

1. For each person, cross out days outside the bill's dates.
2. Count what's left (merge overlaps first).
3. Add all counts → the total.
4. Each share = `(their days ÷ total) × amount`.
5. Shares should sum to the amount (before rounding), give or take a cent.
6. If rounding was on, round each total and compute the leftover.

If your by-hand answer disagrees with the app, **the app is wrong** — report it.

---

## Data & privacy

- **No accounts, no passwords.** Access is by code only.
- **Each house is isolated** — no house can see another's data.
- **What's stored:** house details, members, each person's presence date ranges, and bills. Dates are stored as plain calendar dates. (There is **no change log or audit trail** — nothing records who did what.)
- **Presence data is shared within a house** — housemates can see each other's splits, which is the point (transparency). Be aware this means your housemates can see roughly when you were and weren't home.
- **The app can't prove who did what.** Because access is by shared code, actions aren't tied to a specific person's identity, and nothing is logged.
- **Codes are the security boundary.** Keep them within the house; regenerate if one leaks.

---

## What's deliberately left out

To keep the app simple, cheap, and low-maintenance, these are intentionally **not** included:
- Individual user accounts, passwords, or logins.
- Email/SMS notifications or reminders.
- In-app payment or "mark as paid" tracking.
- Reading bills automatically from a PDF (parked for possible future, opt-in only).
- Real-time collaborative editing.
- Tracking actual usage intensity (we split by days, on purpose).

These aren't oversights — each was considered and left out because it would add cost or upkeep without serving the core goal of a fair, verifiable, low-maintenance split. Some may arrive later if real use justifies them.

---

*This is a living document. As issues surface and clarifications are needed, they'll be added here — especially in [Troubleshooting & FAQ](#troubleshooting--faq).*
