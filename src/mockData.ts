import type { House } from './types';

// ---------------------------------------------------------------------------
// Date helpers (used only to author readable mock presence data)
// ---------------------------------------------------------------------------

/** Inclusive list of ISO date keys from `start` to `end` (YYYY-MM-DD). */
function range(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The single running example house.
//
// The January electricity bill reproduces the calculation-screen reference
// numbers EXACTLY so the math is hand-verifiable:
//   Alice 31 days, Bob 15 days, Carol 21 days  ->  total 67 day-shares
//   31/67 x $100 = $46.27   15/67 x $100 = $22.39   21/67 x $100 = $31.34
//   $46.27 + $22.39 + $31.34 = $100.00  (reconciles)
// ---------------------------------------------------------------------------

const alicePresence = [
  ...range('2026-01-01', '2026-01-31'), // 31 days — full January (locked bill)
  ...range('2026-05-16', '2026-06-09'), // 25 days inside the May–Jun grace bill
];

const bobPresence = [
  ...range('2026-01-01', '2026-01-10'), // 10
  ...range('2026-01-20', '2026-01-24'), // +5  = 15 days in January
  ...range('2026-05-16', '2026-05-19'), // 4 days only — looks incomplete in grace
];

const carolPresence = [
  ...range('2026-01-01', '2026-01-21'), // 21 days in January
  ...range('2026-05-20', '2026-06-06'), // 18 days inside the grace bill
];

export const initialHouse: House = {
  id: 'house-ld12',
  name: 'Lorong Damai 12',
  roomId: 'LD12-7F2',
  memberCode: 'XYZ-4821',
  adminCode: 'QRP-9034',
  members: [
    { id: 'm-alice', name: 'Alice', tone: 'accent', active: true, presence: alicePresence },
    { id: 'm-bob', name: 'Bob', tone: 'alt2', active: true, presence: bobPresence },
    { id: 'm-carol', name: 'Carol', tone: 'alt3', active: true, presence: carolPresence },
  ],
  bills: [
    {
      id: 'bill-jan-elec',
      utility: 'electricity',
      amount: 100,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      status: 'locked',
      lockedOn: '8 Feb 2026',
    },
    {
      id: 'bill-grace-elec',
      utility: 'electricity',
      amount: 142.6,
      periodStart: '2026-05-16',
      periodEnd: '2026-06-15',
      status: 'grace',
      graceEndsOn: '2026-06-27',
    },
    {
      id: 'bill-draft-water',
      utility: 'water',
      amount: 58.4,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      status: 'draft',
    },
  ],
  changeLog: [
    {
      id: 'log-1',
      at: '8 Feb 2026 · 21:14',
      who: 'Admin',
      text: 'Locked January electricity bill ($100.00).',
    },
    {
      id: 'log-2',
      at: '20 Jun 2026 · 09:02',
      who: 'Admin',
      text: 'Confirmed May–Jun electricity bill ($142.60) — 7-day grace window opened.',
    },
  ],
};

/** Today, fixed for the prototype so grace countdowns are deterministic. */
export const TODAY = '2026-06-24';
