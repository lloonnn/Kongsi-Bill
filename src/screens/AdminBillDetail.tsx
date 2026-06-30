import { useState, type CSSProperties } from 'react';
import { useApp } from '../store';
import { Frame, ScreenNav, StatusPill, TopBar } from '../ui';
import { UTILITY_PRESETS, formatPeriod, money } from '../calc';
import type { Bill } from '../types';

const dateStyle: CSSProperties = {
  width: '100%',
  border: '2px solid var(--line)',
  background: 'var(--bg)',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontWeight: 600,
  fontSize: 16,
  padding: '13px 14px',
  color: 'var(--ink)',
  borderRadius: 14,
  outline: 'none',
  marginTop: 8,
};

/** Match a free-text label to a preset, else fall back to the "Other" option. */
function presetFor(label: string): string {
  const hit = UTILITY_PRESETS.find(
    (p) => !p.freeText && p.label.toLowerCase() === label.trim().toLowerCase()
  );
  return hit ? hit.label : 'Other';
}

/**
 * Edit ONE bill — just its details (label, amount, period) and delete. The split
 * is never shown here; all calculation, sharing and closing happens on the
 * Finalize screen, so this stays a small focused editor (not a duplicate of it).
 *
 * Bills are editable while the cycle is open (draft). Once the case is closed
 * (paid) the bill is locked — you reopen just this one bill to correct it.
 */
export function AdminBillDetail() {
  const { house, route } = useApp();
  const bill = house.bills.find((b) => b.bill_id === route.billId);

  if (!bill) {
    return (
      <Frame>
        <TopBar icon="LD" name={house.display_name} sub="Bill" admin />
        <div className="screen">
          <ScreenNav />
          <div className="card admin">
            <p className="sub">That bill no longer exists.</p>
          </div>
        </div>
      </Frame>
    );
  }

  // key on the bill id so the form state resets when navigating between bills.
  return <BillEditor key={bill.bill_id} bill={bill} />;
}

function BillEditor({ bill }: { bill: Bill }) {
  const { house, go, upsertBill, deleteBill, setBillStatus, busy } = useApp();
  const editable = bill.status === 'draft';

  const [preset, setPreset] = useState(presetFor(bill.utility_label));
  const [customLabel, setCustomLabel] = useState(
    presetFor(bill.utility_label) === 'Other' ? bill.utility_label : ''
  );
  const [amount, setAmount] = useState(String(bill.amount));
  const [start, setStart] = useState(bill.period_start);
  const [end, setEnd] = useState(bill.period_end);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saved, setSaved] = useState(false);

  const isOther = preset === 'Other';
  const utility_label = (isOther ? customLabel : preset).trim();
  const amt = parseFloat(amount);
  const valid = !Number.isNaN(amt) && amt > 0 && start <= end && utility_label.length > 0;

  const touch = () => setSaved(false);

  const save = async () => {
    if (!valid) return;
    await upsertBill({
      bill_id: bill.bill_id,
      cycle_id: bill.cycle_id, // keep the bill in its cycle (migration 0005)
      utility_label,
      amount: amt,
      period_start: start,
      period_end: end,
      status: bill.status,
    });
    setSaved(true);
  };

  const remove = async () => {
    await deleteBill(bill.bill_id);
    go({ name: 'admin-dashboard' });
  };

  return (
    <Frame>
      <TopBar icon="LD" name={house.display_name} sub="Edit bill" admin />
      <div className="screen gap">
        <ScreenNav />

        <div className="row-between">
          <div className="working-title" style={{ marginBottom: 0 }}>
            {editable ? '✏️ Edit bill' : '✅ Done bill'}
          </div>
          <StatusPill status={bill.status} />
        </div>

        {!editable ? (
          <div className="card admin">
            <div className="util-row">
              <div>
                <div className="util-label">{bill.utility_label}</div>
                <div className="util-amount tnum">{money(bill.amount)}</div>
                <div className="util-period">{formatPeriod(bill)}</div>
              </div>
            </div>
            <p className="muted-note" style={{ marginTop: 12 }}>
              This bill belongs to a finished billing period, so it’s locked. Reopen just
              this bill to correct it — it’ll rejoin the open bills on the
              Finalize screen.
            </p>
            <button
              className="btn-primary"
              onClick={() => setBillStatus(bill.bill_id, 'draft')}
              disabled={busy}
            >
              Reopen this bill
            </button>
          </div>
        ) : (
          <div className="card admin">
            <span className="field-label">Type of bill</span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                marginTop: 10,
              }}
            >
              {UTILITY_PRESETS.map((p) => (
                <div
                  key={p.label}
                  className={`opt ${preset === p.label ? 'selected' : ''}`}
                  onClick={() => {
                    setPreset(p.label);
                    touch();
                  }}
                >
                  {p.icon} {p.label}
                </div>
              ))}
            </div>
            {isOther && (
              <input
                type="text"
                className="field"
                placeholder="Name this bill"
                value={customLabel}
                onChange={(e) => {
                  setCustomLabel(e.target.value);
                  touch();
                }}
                style={{ marginTop: 10 }}
              />
            )}

            <span className="field-label">Total amount</span>
            <input
              type="text"
              className="field"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                touch();
              }}
              style={{ marginTop: 8 }}
            />

            <span className="field-label">Period</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="date"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  touch();
                }}
                style={dateStyle}
              />
              <input
                type="date"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  touch();
                }}
                style={dateStyle}
              />
            </div>
            {start > end && (
              <p className="muted-note" style={{ color: 'var(--warn-ink)', marginTop: 8 }}>
                Start date must be on or before the end date.
              </p>
            )}

            <button className="btn-primary" disabled={!valid || busy} onClick={save}>
              {saved ? '✓ Saved' : 'Save changes'}
            </button>

            {!confirmingDelete ? (
              <button className="btn-ghost" onClick={() => setConfirmingDelete(true)}>
                Delete this bill
              </button>
            ) : (
              <div className="prompt-strip" style={{ marginTop: 12 }}>
                <span className="pico">🗑️</span>
                <div style={{ flex: 1 }}>
                  Delete <b>{bill.utility_label}</b> for good? This can’t be undone.
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="btn-primary" style={{ marginTop: 0 }} onClick={remove} disabled={busy}>
                      Yes, delete
                    </button>
                    <button className="btn-ghost" style={{ marginTop: 0 }} onClick={() => setConfirmingDelete(false)}>
                      Keep it
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Frame>
  );
}
