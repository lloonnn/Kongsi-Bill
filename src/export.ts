// CSV export of the house's bills, grouped into billing periods.
//
// Output format is plain CSV TEXT — every cell is a static, already-computed
// value, exactly as the app displays it. (An earlier build emitted an XLSX
// workbook with live formulas; the product owner deliberately traded that away
// to drop the SheetJS dependency and ship plain CSV. No formulas remain.)
//
// REUSE NOTE: periods are grouped with the SAME logic the history screens use —
// groupBillsByCycle() from calc.ts (migration 0005) — imported and called
// directly. Bills are grouped under their explicit, admin-named cycle; cycles
// come back newest-first (readHouse order), and the export inherits that order.
// Each table is headed by the cycle's name plus its [earliest start, latest end]
// span across that cycle's bills. (Replaces the old by-month grouping.)
//
// CALC NOTE (Phase 6 recon §B): per-person days/fees for draft & confirmed bills
// come straight from calc.ts calculate().shares — the SAME cent-allocation the
// app already shows on screen (BillOverview), one source of number. Paid bills
// read their frozen paid_snapshot instead, so a later soft-removed member still
// appears exactly as recorded. The calc.ts active-member filter is unchanged and
// still flagged (out of scope for Phase 6). The Worker never calculates.

import type { Bill, HouseState } from './types';
import { billLabel, calculate, groupBillsByCycle, NO_ROUNDING, type CycleGroup } from './calc';

/** DD/MM/YYYY for a YYYY-MM-DD key. */
function fmtDate(key: string): string {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * The combined span shown as a period's header: earliest start → latest end
 * across the period's bills (the PO-confirmed display rule). This is additive
 * and does not affect which bills group together.
 */
function periodSpanLabel(bills: Bill[]): string {
  let start = bills[0].period_start;
  let end = bills[0].period_end;
  for (const b of bills) {
    if (b.period_start < start) start = b.period_start;
    if (b.period_end > end) end = b.period_end;
  }
  return `${fmtDate(start)} - ${fmtDate(end)}`;
}

interface MemberCell {
  days: number;
  amount: number;
  name: string;
}

interface Split {
  totalDays: number;
  byMember: Map<string, MemberCell>;
}

/**
 * One bill's per-person split. Paid bills with a snapshot are FROZEN (read
 * straight from paid_snapshot); everything else uses calc.ts calculate() — the
 * identical rule BillOverview uses, and the same numbers shown on screen.
 */
function splitFor(bill: Bill, house: HouseState): Split {
  if (bill.status === 'paid' && bill.paid_snapshot != null) {
    const byMember = new Map<string, MemberCell>(
      bill.paid_snapshot.map((e) => [e.member_id, { days: e.days, amount: e.amount, name: e.name }])
    );
    const totalDays = bill.paid_snapshot.reduce((s, e) => s + e.days, 0);
    return { totalDays, byMember };
  }
  const calc = calculate(bill, house.members, NO_ROUNDING);
  const byMember = new Map<string, MemberCell>(
    calc.shares.map((s) => [
      s.member.member_id,
      { days: s.days, amount: s.amount, name: s.member.name },
    ])
  );
  return { totalDays: calc.totalDays, byMember };
}

/** Two-decimal money string (no symbol) for a CSV cell. */
function money(n: number): string {
  return n.toFixed(2);
}

// ---------------------------------------------------------------------------
// CSV building. RFC 4180 escaping: a field is quoted iff it contains a comma,
// double-quote, CR or LF; embedded double-quotes are doubled. Rows joined with
// CRLF (the RFC line ending; Excel/Sheets read it fine).
// ---------------------------------------------------------------------------

type Field = string | number;

function escapeField(value: Field): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toRow(fields: Field[]): string {
  return fields.map(escapeField).join(',');
}

/**
 * Build the CSV lines for ONE cycle's table:
 *   Cycle: <name> (<span>)
 *   No | Name | <U> Days | <U> Fees | ... | Total
 *   <one row per member>
 *   (grand total row — sums ONLY the Total column)
 */
function cycleLines(group: CycleGroup, house: HouseState): string[] {
  const bills = group.bills;
  // Left-to-right utility order: by period start, then label, for stability.
  const ordered = bills.slice().sort((a, b) =>
    a.period_start < b.period_start
      ? -1
      : a.period_start > b.period_start
        ? 1
        : billLabel(a) < billLabel(b)
          ? -1
          : 1
  );
  const splits = ordered.map((b) => splitFor(b, house));

  // Member union: currently-active members first (house order), then anyone who
  // appears only in a snapshot (e.g. soft-removed after settling) — mirrors
  // BillOverview so a frozen bill still lists everyone it was split between.
  const memberOrder: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const m of house.members) {
    if (m.active) {
      memberOrder.push({ id: m.member_id, name: m.name });
      seen.add(m.member_id);
    }
  }
  for (const sp of splits) {
    for (const [id, e] of sp.byMember) {
      if (!seen.has(id)) {
        seen.add(id);
        memberOrder.push({ id, name: e.name });
      }
    }
  }

  const lines: string[] = [];
  lines.push(toRow([`Cycle: ${group.cycle.display_name} (${periodSpanLabel(ordered)})`]));

  // Header: No | Name | <U> Days | <U> Fees | ... | Total
  const header: Field[] = ['No', 'Name'];
  for (const b of ordered) {
    header.push(`${billLabel(b)} Days`, `${billLabel(b)} Fees`);
  }
  header.push('Total');
  lines.push(toRow(header));

  // Member rows.
  let grandTotal = 0;
  memberOrder.forEach((m, mi) => {
    const row: Field[] = [mi + 1, m.name];
    let rowTotal = 0;
    for (const sp of splits) {
      const entry = sp.byMember.get(m.id);
      if (entry) {
        row.push(entry.days, money(entry.amount));
        rowTotal += entry.amount;
      } else {
        row.push('', ''); // member not part of this bill → blank cells
      }
    }
    rowTotal = Math.round(rowTotal * 100) / 100;
    row.push(money(rowTotal));
    grandTotal += rowTotal;
    lines.push(toRow(row));
  });

  // Grand total — sums ONLY the Total column (per the product owner), not the
  // per-utility fee columns. Leave the Days/Fees cells blank.
  const totalRow: Field[] = ['', 'TOTAL'];
  for (let i = 0; i < ordered.length; i++) totalRow.push('', '');
  totalRow.push(money(Math.round(grandTotal * 100) / 100));
  lines.push(toRow(totalRow));

  return lines;
}

/** Join cycle blocks into a single CSV document, blank line between tables. */
function buildCsv(house: HouseState, groups: CycleGroup[]): string {
  return groups.map((g) => cycleLines(g, house).join('\r\n')).join('\r\n\r\n');
}

/** Trigger a browser download of `text` as a .csv file. */
function downloadCsv(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Export the latest cycle — the newest cycle that has any bills, with ALL of its
 * bills (PO-confirmed). Cycles come back newest-first, so that's the first
 * non-empty group; empty cycles (named but no bills yet) are skipped so the file
 * is never blank.
 */
export function exportLatest(house: HouseState): void {
  const groups = groupBillsByCycle(house.bills, house.cycles).filter((g) => g.bills.length > 0);
  if (groups.length === 0) throw new Error('No bills to export yet.');
  downloadCsv('kongsi-bill-latest.csv', buildCsv(house, [groups[0]]));
}

/** Export every cycle that has bills, each as its own labelled table. */
export function exportHistory(house: HouseState): void {
  const groups = groupBillsByCycle(house.bills, house.cycles).filter((g) => g.bills.length > 0);
  if (groups.length === 0) throw new Error('No bills to export yet.');
  downloadCsv('kongsi-bill-history.csv', buildCsv(house, groups));
}
