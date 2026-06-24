import { useState } from 'react';
import { useApp } from '../store';
import { BackLink, ExtrapolatedTag, Frame, StatusPill, TopBar } from '../ui';
import { BillSummaryCard, WorkingCard } from '../BillBreakdown';
import { NO_ROUNDING } from '../calc';
import type { BillStatus } from '../types';

const LIFECYCLE: { key: BillStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'grace', label: 'Confirmed · grace' },
  { key: 'locked', label: 'Locked' },
];

/**
 * Single bill detail: lifecycle state, per-person breakdown, and — for locked
 * bills — the admin-override-after-lock path (every override is logged to the
 * visible change log). Extrapolated screen.
 */
export function AdminBillDetail() {
  const { house, route, back, go, overrideLockedBill } = useApp();
  const bill = house.bills.find((b) => b.id === route.billId);
  const [overriding, setOverriding] = useState(false);
  const [newAmount, setNewAmount] = useState('');

  if (!bill) {
    return (
      <Frame>
        <TopBar icon="LD" name={house.name} sub="Bill" admin />
        <div className="screen">
          <BackLink onClick={back} />
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
        <BackLink onClick={back} />

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

        {/* admin override after lock */}
        {bill.status === 'locked' && (
          <div className="card admin">
            <div className="working-title">Admin override</div>
            {!overriding ? (
              <>
                <p className="muted-note" style={{ marginBottom: 12 }}>
                  Locked bills are fixed. If the amount was wrong, you can override
                  it — the change is recorded in the house change log for everyone
                  to see.
                </p>
                <button className="btn-secondary" onClick={() => setOverriding(true)}>
                  Override locked amount
                </button>
              </>
            ) : (
              <>
                <span className="field-label">New total amount</span>
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
                  Apply override &amp; log it
                </button>
                <button className="btn-ghost" onClick={() => setOverriding(false)}>
                  Cancel
                </button>
              </>
            )}
            <button
              className="btn-ghost"
              onClick={() => go({ name: 'admin-changelog' })}
            >
              View change log
            </button>
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
