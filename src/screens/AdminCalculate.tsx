import { useState } from 'react';
import { useApp } from '../store';
import { BackLink, Frame, TopBar } from '../ui';
import { BillSummaryCard, WorkingCard } from '../BillBreakdown';
import { calculate, remainderSentence } from '../calc';
import type { RoundingConfig } from '../types';

/**
 * Calculate & validate screen. Shows every share's literal working, a
 * reconciliation strip, and an off-by-default rounding toggle whose remainder
 * is always stated in plain-consequence language (never silently absorbed).
 */
export function AdminCalculate() {
  const { house, route, go, back, confirmBill, lockBill } = useApp();
  const bill = house.bills.find((b) => b.id === route.billId);

  const [rounding, setRounding] = useState<RoundingConfig>({
    enabled: false,
    mode: 'down',
    increment: 0.05,
  });

  if (!bill) {
    return (
      <Frame>
        <TopBar icon="LD" name={house.name} sub="Calculate" admin />
        <div className="screen">
          <BackLink onClick={back} />
          <div className="card admin">
            <p className="sub">That bill no longer exists.</p>
          </div>
        </div>
      </Frame>
    );
  }

  const calc = calculate(bill, house.members, rounding);
  const blocked = calc.reconciliation.status === 'warn';

  const confirm = () => {
    if (bill.status === 'draft') confirmBill(bill.id);
    else if (bill.status === 'grace') lockBill(bill.id);
    go({ name: 'admin-dashboard' });
  };

  const primaryLabel =
    bill.status === 'draft'
      ? 'Looks right — confirm bill'
      : bill.status === 'grace'
      ? 'Lock this bill now'
      : 'Bill is locked';

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="Calculate & validate" admin />
      <div className="screen gap">
        <BackLink onClick={back} />

        <BillSummaryCard bill={bill} />
        <WorkingCard bill={bill} members={house.members} rounding={rounding} calc={calc} />

        {/* rounding toggle card */}
        <div className="card admin">
          <div className="toggle-row">
            <div>
              <div className="toggle-label">Round final amounts</div>
              <div className="toggle-sub">Off by default — full precision</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={rounding.enabled}
                onChange={(e) =>
                  setRounding((r) => ({ ...r, enabled: e.target.checked }))
                }
              />
              <span className="switch-track" />
            </label>
          </div>

          {rounding.enabled && (
            <>
              <div className="round-options">
                <div
                  className={`round-option ${rounding.mode === 'down' ? 'selected' : ''}`}
                  onClick={() => setRounding((r) => ({ ...r, mode: 'down' }))}
                >
                  <div className="ro-label">Round down</div>
                  <div className="ro-sub">to nearest $0.05</div>
                </div>
                <div
                  className={`round-option ${rounding.mode === 'up' ? 'selected' : ''}`}
                  onClick={() => setRounding((r) => ({ ...r, mode: 'up' }))}
                >
                  <div className="ro-label">Round up</div>
                  <div className="ro-sub">to nearest $0.05</div>
                </div>
              </div>
              <div className="remainder-note">{remainderSentence(calc.remainder)}</div>
            </>
          )}
        </div>

        <button className="btn-primary" disabled={blocked || bill.status === 'locked'} onClick={confirm}>
          {blocked ? 'Resolve the flag above first' : primaryLabel}
        </button>
        {bill.status === 'draft' && (
          <p className="muted-note" style={{ textAlign: 'center' }}>
            Confirming opens a 7-day grace window before the split locks.
          </p>
        )}
      </div>
    </Frame>
  );
}
