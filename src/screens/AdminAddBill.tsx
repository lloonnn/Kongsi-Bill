import { useState, type CSSProperties } from 'react';
import { useApp } from '../store';
import { ExtrapolatedTag, Frame, ProgressRow, ScreenNav, TopBar } from '../ui';
import { billIcon, formatPeriod, money, UTILITY_PRESETS } from '../calc';

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

/**
 * Add one or more bills in a single sitting. Each added bill is saved (as a
 * draft) immediately and shown in a running preview list below the form, so the
 * admin can keep adding ("Add bill") and remove anything entered wrongly. They
 * are NOT confirmed/locked here — confirming is a separate, deliberate step on
 * each bill's own page. Extrapolated screen.
 */
export function AdminAddBill() {
  const { house, go, upsertBill, deleteBill, busy, error } = useApp();
  // The dropdown is a frontend convenience; whatever is chosen (or typed for
  // "Other") resolves to the single free-text utility_label sent to the API.
  const [preset, setPreset] = useState('Water');
  const [customLabel, setCustomLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [start, setStart] = useState('2026-06-01');
  const [end, setEnd] = useState('2026-06-30');
  // bill_ids added during this sitting, newest last — drives the preview list.
  const [addedIds, setAddedIds] = useState<string[]>([]);

  const isOther = preset === 'Other';
  const utility_label = (isOther ? customLabel : preset).trim();

  const amt = parseFloat(amount);
  const valid = !Number.isNaN(amt) && amt > 0 && start <= end && utility_label.length > 0;

  const added = addedIds
    .map((id) => house.bills.find((b) => b.bill_id === id))
    .filter((b): b is NonNullable<typeof b> => !!b);

  const addBill = async () => {
    if (!valid) return;
    const id = await upsertBill({
      utility_label,
      amount: amt,
      period_start: start,
      period_end: end,
    });
    setAddedIds((ids) => [...ids, id]);
    // Reset the parts that differ per bill; keep the period (same cycle usually).
    setAmount('');
    setCustomLabel('');
  };

  const remove = async (id: string) => {
    await deleteBill(id);
    setAddedIds((ids) => ids.filter((x) => x !== id));
  };

  return (
    <Frame>
      <TopBar icon="LD" name={house.display_name} sub="Add bills" admin />
      <div className="screen">
        <ScreenNav />
        <ProgressRow total={2} done={1} admin />

        <div className="card admin">
          <ExtrapolatedTag />
          <div className="eyebrow-pill admin">🧾 New bill</div>
          <h1 className="title sm">{added.length ? 'Add another bill' : "What's this bill?"}</h1>
          <p className="sub">
            Enter the total and the period it covers. Add as many as you like —
            each is saved as a draft you can review and confirm later.
          </p>

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
                onClick={() => setPreset(p.label)}
              >
                {p.icon} {p.label}
              </div>
            ))}
          </div>

          {isOther && (
            <input
              type="text"
              className="field"
              placeholder="Name this bill (e.g. Cleaning, Cooking gas)"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              style={{ marginTop: 10 }}
            />
          )}

          {/* Echo the resolved label so it's obvious what will be saved. */}
          <p className="muted-note" style={{ marginTop: 8 }}>
            Saving as: <b>{utility_label || '—'}</b>
          </p>

          <span className="field-label">Total amount</span>
          <input
            type="text"
            className="field"
            inputMode="decimal"
            placeholder="e.g. 58.40"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ marginTop: 8 }}
          />

          <span className="field-label">Period</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={dateStyle} />
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={dateStyle} />
          </div>
          {start > end && (
            <p className="muted-note" style={{ color: 'var(--warn-ink)', marginTop: 8 }}>
              Start date must be on or before the end date.
            </p>
          )}

          <button className="btn-primary" disabled={!valid || busy} onClick={addBill}>
            {busy ? 'Saving…' : added.length ? '+ Add this bill' : '+ Add bill'}
          </button>
          {error && (
            <p className="muted-note" style={{ color: 'var(--warn-ink)', marginTop: 8 }}>
              {error}
            </p>
          )}
        </div>

        {/* running preview of everything added this sitting */}
        {added.length > 0 && (
          <div className="card admin">
            <div className="working-title">Added this time · {added.length}</div>
            {added.map((b) => (
              <div className="member-pill" key={b.bill_id}>
                <div className="left">
                  <div className="bill-icon" style={{ width: 34, height: 34, fontSize: 16 }}>
                    {billIcon(b)}
                  </div>
                  <div>
                    <div className="name">
                      {b.utility_label} · <span className="tnum">{money(b.amount)}</span>
                    </div>
                    <div className="meta">{formatPeriod(b)}</div>
                  </div>
                </div>
                <button className="remove-x" onClick={() => remove(b.bill_id)} aria-label={`Delete ${b.utility_label}`}>
                  ✕
                </button>
              </div>
            ))}

            <p className="muted-note" style={{ marginTop: 12 }}>
              These are saved as <b>drafts</b>. Open a bill from the house to
              review the split and confirm (lock) it — that’s a separate step, so
              nothing locks by accident here.
            </p>
            <button className="btn-primary" onClick={() => go({ name: 'admin-dashboard' })}>
              Done — back to house
            </button>
          </div>
        )}
      </div>
    </Frame>
  );
}
