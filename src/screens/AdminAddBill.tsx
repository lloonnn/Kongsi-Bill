import { useState, type CSSProperties } from 'react';
import { useApp } from '../store';
import { BackLink, ExtrapolatedTag, Frame, ProgressRow, TopBar } from '../ui';
import { UTILITY_META } from '../calc';
import type { Utility } from '../types';

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

/** Add a new bill (draft). Extrapolated — own layout, locked tokens. */
export function AdminAddBill() {
  const { house, go, back, addBill } = useApp();
  const [utility, setUtility] = useState<Utility>('water');
  const [amount, setAmount] = useState('');
  const [start, setStart] = useState('2026-06-01');
  const [end, setEnd] = useState('2026-06-30');

  const amt = parseFloat(amount);
  const valid = !Number.isNaN(amt) && amt > 0 && start <= end;

  const save = () => {
    if (!valid) return;
    const id = addBill({ utility, amount: amt, periodStart: start, periodEnd: end });
    go({ name: 'admin-calculate', billId: id });
  };

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="Add a bill" admin />
      <div className="screen">
        <BackLink onClick={back} />
        <ProgressRow total={2} done={1} admin />

        <div className="card admin">
          <ExtrapolatedTag />
          <div className="eyebrow-pill admin">🧾 New bill</div>
          <h1 className="title sm">What's this bill?</h1>
          <p className="sub">
            Enter the total and the period it covers. You'll see the day-weighted
            split on the next screen before anything is confirmed.
          </p>

          <span className="field-label">Utility</span>
          <div className="seg-choice">
            {(Object.keys(UTILITY_META) as Utility[]).map((u) => (
              <div
                key={u}
                className={`opt ${utility === u ? 'selected' : ''}`}
                onClick={() => setUtility(u)}
              >
                {UTILITY_META[u].icon} {UTILITY_META[u].label}
              </div>
            ))}
          </div>

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

          <button className="btn-primary" disabled={!valid} onClick={save}>
            See the split
          </button>
        </div>
      </div>
    </Frame>
  );
}
