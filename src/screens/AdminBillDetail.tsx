import { useState } from 'react';
import { useApp } from '../store';
import { ExtrapolatedTag, Frame, ScreenNav, StatusPill, TopBar } from '../ui';
import { BillSummaryCard, WorkingCard } from '../BillBreakdown';
import { money, NO_ROUNDING } from '../calc';
import type { BillStatus } from '../types';

const LIFECYCLE: { key: BillStatus; label: string }[] = [
  { key: 'open', label: 'Open · marking days' },
  { key: 'locked', label: 'Locked · final' },
];

/**
 * Single bill detail: lifecycle state, per-person breakdown, and — for locked
 * bills — the re-open / admin-override-after-lock paths. Extrapolated screen.
 */
export function AdminBillDetail() {
  const { house, route, go, overrideLockedBill, reopenBill } = useApp();
  const bill = house.bills.find((b) => b.id === route.billId);
  const [overriding, setOverriding] = useState(false);
  const [newAmount, setNewAmount] = useState('');

  if (!bill) {
    return (
      <Frame>
        <TopBar icon="LD" name={house.name} sub="Bill" admin />
        <div className="screen">
          <ScreenNav />
          <div className="card admin">
            <p className="sub">That bill no longer exists.</p>
          </div>
        </div>
      </Frame>
    );
  }

  const stageIndex = LIFECYCLE.findIndex((s) => s.key === bill.status);

  const applyOverride = () => {
    const amt = parseFloat(newAmount);
    if (Number.isNaN(amt) || amt <= 0) return;
    overrideLockedBill(bill.id, amt);
    setOverriding(false);
    setNewAmount('');
  };

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="Bill detail" admin />
      <div className="screen gap">
        <ScreenNav />

        {/* lifecycle stepper */}
        <div className="card admin">
          <ExtrapolatedTag />
          <div className="row-between" style={{ marginBottom: 12 }}>
            <div className="working-title" style={{ marginBottom: 0 }}>
              Lifecycle
            </div>
            <StatusPill status={bill.status} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {LIFECYCLE.map((s, i) => (
              <div key={s.key} style={{ flex: 1, textAlign: 'center' }}>
                <div
                  className="seg"
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: i <= stageIndex ? 'var(--ink)' : 'var(--line)',
                  }}
                />
                <div
                  className="lr-sub"
                  style={{ marginTop: 6, color: i <= stageIndex ? 'var(--ink)' : 'var(--muted)' }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          {bill.lockedOn && (
            <p className="muted-note" style={{ marginTop: 12 }}>
              Locked on {bill.lockedOn}. The split below is final.
            </p>
          )}
        </div>

        <BillSummaryCard bill={bill} />
        <WorkingCard bill={bill} members={house.members} rounding={NO_ROUNDING} />

        {/* fixing a locked bill: re-open to fix days, or override the amount */}
        {bill.status === 'locked' && (
          <div className="card admin">
            <div className="working-title">Spotted a mistake?</div>
            {!overriding ? (
              <>
                <p className="muted-note" style={{ marginBottom: 14 }}>
                  This bill is locked, but you can still fix a mistake. Hover (or
                  tap) an option to see what it does.
                </p>

                <div className="fix-option" tabIndex={0} style={{ marginBottom: 14 }}>
                  <div className="toggle-label">
                    The total amount was wrong <span className="hint-dot">ⓘ</span>
                  </div>
                  <div className="toggle-sub fix-desc">
                    e.g. the real bill was $150, not {money(bill.amount)}. Fix the
                    total and everyone’s share updates automatically.
                  </div>
                  <button className="btn-secondary" onClick={() => setOverriding(true)}>
                    Correct the amount
                  </button>
                </div>

                <div className="fix-option" tabIndex={0}>
                  <div className="toggle-label">
                    Someone’s days were wrong <span className="hint-dot">ⓘ</span>
                  </div>
                  <div className="toggle-sub fix-desc">
                    Re-open the bill to fix who was home, then lock it again.
                  </div>
                  <button className="btn-secondary" onClick={() => reopenBill(bill.id)}>
                    Re-open to fix days
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="muted-note" style={{ marginBottom: 4 }}>
                  Enter the correct total. Each person’s share is recalculated
                  against it.
                </p>
                <span className="field-label">Correct total amount</span>
                <input
                  type="text"
                  className="field"
                  inputMode="decimal"
                  placeholder={bill.amount.toFixed(2)}
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  style={{ marginTop: 8 }}
                />
                <button className="btn-primary" onClick={applyOverride}>
                  Save corrected amount
                </button>
                <button className="btn-ghost" onClick={() => setOverriding(false)}>
                  Cancel
                </button>
              </>
            )}
          </div>
        )}

        {bill.status !== 'locked' && (
          <button
            className="btn-primary"
            onClick={() => go({ name: 'admin-calculate', billId: bill.id })}
          >
            Open in calculate &amp; validate
          </button>
        )}
      </div>
    </Frame>
  );
}
