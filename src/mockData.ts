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
// Everyone is home by default; members only record the days they were AWAY.
// The January electricity bill (1–31 Jan, 31 days) still reproduces the
// calculation-screen reference EXACTLY, via away-days:
//   Alice away 0  -> home 31      Bob away 16 -> home 15      Carol away 10 -> home 21
//   total 67 home-day-shares
//   31/67 x $100 = $46.27   15/67 x $100 = $22.39   21/67 x $100 = $31.34
//   $46.27 + $22.39 + $31.34 = $100.00  (reconciles)
// ---------------------------------------------------------------------------

// Alice: home all January; a short trip 10–15 Jun.
const aliceAway = [...range('2026-06-10', '2026-06-15')];

// Bob: away 16 days in January (home 15); away most of the May–Jun period.
const bobAway = [
  ...range('2026-01-11', '2026-01-19'), // 9
  ...range('2026-01-25', '2026-01-31'), // +7 = 16 away in January
  ...range('2026-05-16', '2026-06-11'), // away most of the open electricity period
];

// Carol: away last 10 days of January (home 21); a couple of trips in May–Jun.
const carolAway = [
  ...range('2026-01-22', '2026-01-31'), // 10 away in January
  ...range('2026-05-16', '2026-05-19'), // 4
  ...range('2026-06-07', '2026-06-15'), // +9
];

export const initialHouse: House = {
  id: 'house-ld12',
  name: 'Lorong Damai 12',
  roomId: 'LD12-7F2',
  memberCode: 'XYZ-4821',
  adminCode: 'QRP-9034',
  adminMemberId: 'm-alice', // Alice set up the house and is also a housemate
  members: [
    { id: 'm-alice', name: 'Alice', tone: 'accent', active: true, awayDays: aliceAway },
    { id: 'm-bob', name: 'Bob', tone: 'alt2', active: true, awayDays: bobAway },
    { id: 'm-carol', name: 'Carol', tone: 'alt3', active: true, awayDays: carolAway },
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
      id: 'bill-open-elec',
      utility: 'electricity',
      amount: 142.6,
      periodStart: '2026-05-16',
      periodEnd: '2026-06-15',
      status: 'open',
      // Alice & Carol have confirmed their days; Bob hasn't looked yet.
      confirmedMemberIds: ['m-alice', 'm-carol'],
    },
    {
      id: 'bill-open-water',
      utility: 'water',
      amount: 58.4,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      status: 'open',
      confirmedMemberIds: ['m-alice', 'm-carol'],
    },
  ],
};

/** Today, fixed for the prototype so timestamps are deterministic. */
export const TODAY = '2026-06-24';
