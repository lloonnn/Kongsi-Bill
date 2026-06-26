import type { HouseState } from './types';

// ---------------------------------------------------------------------------
// A demo house used to seed the context for offline click-through. Once a real
// house is created or joined (store.createHouse / store.joinHouse), this is
// replaced by live state from the Worker. It is shaped exactly like the API's
// GET /house/:id response.
//
// Presence is now PRESENT ranges (days home), matching the API — the opposite
// of the prototype's away-day list. The January electricity bill (1–31 Jan,
// 31 days) still reproduces the calculation-screen reference EXACTLY:
//   Alice present all 31      Bob present 15 (1–10, 20–24)      Carol present 21 (1–21)
//   total 67 home-day-shares
//   31/67 × $100 = $46.27   15/67 × $100 = $22.39   21/67 × $100 = $31.34   → $100.00
// ---------------------------------------------------------------------------

export const initialHouse: HouseState = {
  house_id: 'LD12-7F2',
  display_name: 'Lorong Damai 12',
  member_code: 'XYZ-4821',
  created_at: '2026-01-01',
  members: [
    {
      member_id: 'm-alice',
      name: 'Alice',
      active: true,
      days_confirmed: true,
      // Home all period except a short trip 10–15 Jun.
      presence: [
        { start: '2026-01-01', end: '2026-06-09' },
        { start: '2026-06-16', end: '2026-06-30' },
      ],
    },
    {
      member_id: 'm-bob',
      name: 'Bob',
      active: true,
      days_confirmed: false, // hasn't reviewed his days yet
      // Away 11–19 & 25–31 Jan (home 15), away most of 16 May–11 Jun.
      presence: [
        { start: '2026-01-01', end: '2026-01-10' },
        { start: '2026-01-20', end: '2026-01-24' },
        { start: '2026-02-01', end: '2026-05-15' },
        { start: '2026-06-12', end: '2026-06-30' },
      ],
    },
    {
      member_id: 'm-carol',
      name: 'Carol',
      active: true,
      days_confirmed: true,
      // Away last 10 days of Jan (home 21); a couple of trips in May–Jun.
      presence: [
        { start: '2026-01-01', end: '2026-01-21' },
        { start: '2026-02-01', end: '2026-05-15' },
        { start: '2026-05-20', end: '2026-06-06' },
        { start: '2026-06-16', end: '2026-06-30' },
      ],
    },
  ],
  bills: [
    {
      bill_id: 'bill-jan-elec',
      utility_label: 'Electricity',
      amount: 100,
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      status: 'paid', // settled & closed — already paid the landlord
    },
    {
      bill_id: 'bill-open-elec',
      utility_label: 'Electricity',
      amount: 142.6,
      period_start: '2026-05-16',
      period_end: '2026-06-15',
      status: 'draft',
    },
    {
      bill_id: 'bill-open-water',
      utility_label: 'Water',
      amount: 58.4,
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      status: 'draft',
    },
  ],
};

/** The admin code for the demo house — held separately, as the API does. */
export const initialAdminCode = 'QRP-9034';

/** Today, fixed for the prototype so timestamps are deterministic. */
export const TODAY = '2026-06-24';
