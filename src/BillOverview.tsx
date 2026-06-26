import { useApp } from './store';
import { StatusPill } from './ui';
import {
  billIcon,
  billLabel,
  calculate,
  formatPeriod,
  money,
  NO_ROUNDING,
  type Calculation,
} from './calc';
import type { Bill } from './types';

/**
 * Combined overview matrix: every bill (rows) × every housemate (columns),
 * showing each person's share and home-day count, plus running totals. Shared
 * by the admin history screen and the member-facing history screen.
 *
 * `bills` scopes the table to a subset (e.g. one combined month); defaults to
 * all house bills. `onOpenBill` (admin only) makes the bill name tappable.
 */
export function BillOverview({
  bills: billsProp,
  onOpenBill,
}: {
  bills?: Bill[];
  onOpenBill?: (billId: string) => void;
}) {
  const { house } = useApp();
  const members = house.members.filter((m) => m.active);
  const bills = (billsProp ?? house.bills)
    .slice()
    .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));

  const rows = bills.map((bill) => ({
    bill,
    calc: calculate(bill, house.members, NO_ROUNDING),
  }));

  const shareFor = (calc: Calculation, memberId: string) =>
    calc.shares.find((s) => s.member.id === memberId);

  const memberTotal = (memberId: string) =>
    rows.reduce((sum, { calc }) => {
      const s = shareFor(calc, memberId);
      return sum + (s && s.days > 0 ? s.amount : 0);
    }, 0);

  const grandTotal = bills.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="overview-wrap">
      <table className="overview-table">
        <thead>
          <tr>
            <th className="bill-head">Bill</th>
            {members.map((m) => (
              <th key={m.id}>{m.name}</th>
            ))}
            <th className="col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ bill, calc }) => (
            <tr key={bill.id}>
              <td className="bill-cell">
                {onOpenBill ? (
                  <button className="bill-name" onClick={() => onOpenBill(bill.id)}>
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
              {members.map((m) => {
                const s = shareFor(calc, m.id);
                const has = s && s.days > 0;
                return (
                  <td key={m.id} className={has ? 'amt' : 'muted-cell'}>
                    {has ? (
                      <>
                        {money(s!.amount)}
                        <div className="bill-period">{s!.days}d home</div>
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
            {members.map((m) => (
              <td key={m.id}>{money(memberTotal(m.id))}</td>
            ))}
            <td className="col-total">{money(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
