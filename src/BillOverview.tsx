import { useApp } from './store';
import { StatusPill } from './ui';
import { billIcon, billLabel, calculate, formatPeriod, money, NO_ROUNDING } from './calc';
import type { Bill, PaidSnapshotEntry } from './types';

/**
 * Combined overview matrix: every bill (rows) × every housemate (columns),
 * showing each person's share and home-day count, plus running totals. Shared
 * by the admin history screen and the member-facing history screen.
 *
 * `bills` scopes the table to a subset (e.g. one combined month); defaults to
 * all house bills. `onOpenBill` (admin only) makes the bill name tappable.
 *
 * Paid bills render their FROZEN split (bill.paid_snapshot, migration 0004) so a
 * later soft-removed member can't retroactively shift a settled split. Draft
 * bills — and any paid bill with no snapshot (settled before 0004) — recalculate
 * live, unchanged.
 */
export function BillOverview({
  bills: billsProp,
  onOpenBill,
}: {
  bills?: Bill[];
  onOpenBill?: (billId: string) => void;
}) {
  const { house } = useApp();
  const bills = (billsProp ?? house.bills)
    .slice()
    .sort((a, b) => (a.period_start < b.period_start ? 1 : -1));

  // Per-bill split entries: the stored snapshot for a paid bill that has one,
  // otherwise a live recalc (draft, or pre-0004 paid bill). Both paths produce
  // the same { member_id, name, days, amount } shape.
  const entriesFor = (bill: Bill): PaidSnapshotEntry[] => {
    if (bill.status === 'paid' && bill.paid_snapshot != null) return bill.paid_snapshot;
    return calculate(bill, house.members, NO_ROUNDING).shares.map((s) => ({
      member_id: s.member.member_id,
      name: s.member.name,
      days: s.days,
      amount: s.amount,
    }));
  };

  const rows = bills.map((bill) => {
    const entries = entriesFor(bill);
    return { bill, byMember: new Map(entries.map((e) => [e.member_id, e])) };
  });

  // Columns = currently-active members first (stable order), then any member who
  // appears only in a snapshot (e.g. soft-removed after settling), so a frozen
  // bill still shows everyone it was split between — with their captured name.
  const columns: { member_id: string; name: string }[] = house.members
    .filter((m) => m.active)
    .map((m) => ({ member_id: m.member_id, name: m.name }));
  const seen = new Set(columns.map((c) => c.member_id));
  for (const { byMember } of rows) {
    for (const e of byMember.values()) {
      if (!seen.has(e.member_id)) {
        seen.add(e.member_id);
        columns.push({ member_id: e.member_id, name: e.name });
      }
    }
  }

  const memberTotal = (memberId: string) =>
    rows.reduce((sum, { byMember }) => {
      const e = byMember.get(memberId);
      return sum + (e && e.days > 0 ? e.amount : 0);
    }, 0);

  const grandTotal = bills.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="overview-wrap">
      <table className="overview-table">
        <thead>
          <tr>
            <th className="bill-head">Bill</th>
            {columns.map((c) => (
              <th key={c.member_id}>{c.name}</th>
            ))}
            <th className="col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ bill, byMember }) => (
            <tr key={bill.bill_id}>
              <td className="bill-cell">
                {onOpenBill ? (
                  <button className="bill-name" onClick={() => onOpenBill(bill.bill_id)}>
                    {billIcon(bill)} {billLabel(bill)}
                  </button>
                ) : (
                  <span className="bill-name" style={{ cursor: 'default' }}>
                    {billIcon(bill)} {billLabel(bill)}
                  </span>
                )}
                <div className="bill-period">{formatPeriod(bill)}</div>
                <div style={{ marginTop: 4 }}>
                  <StatusPill status={bill.status} />
                </div>
              </td>
              {columns.map((c) => {
                const e = byMember.get(c.member_id);
                const has = e && e.days > 0;
                return (
                  <td key={c.member_id} className={has ? 'amt' : 'muted-cell'}>
                    {has ? (
                      <>
                        {money(e!.amount)}
                        <div className="bill-period">{e!.days}d home</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                );
              })}
              <td className="amt col-total">{money(bill.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="bill-cell">Each pays</td>
            {columns.map((c) => (
              <td key={c.member_id}>{money(memberTotal(c.member_id))}</td>
            ))}
            <td className="col-total">{money(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
