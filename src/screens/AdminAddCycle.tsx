import { useState } from 'react';
import { useApp } from '../store';
import { Frame, ScreenNav, TopBar } from '../ui';

/**
 * Create a billing cycle (migration 0005): the admin types its name (e.g.
 * "June 2026"), and we drop straight into adding that cycle's bills. A cycle
 * groups one period's bills; Calculate later acts on one cycle at a time.
 * Extrapolated screen.
 */
export function AdminAddCycle() {
  const { house, go, upsertCycle, busy, error } = useApp();
  const [name, setName] = useState('');

  const valid = name.trim().length > 0;

  const create = async () => {
    if (!valid) return;
    const cycleId = await upsertCycle({ display_name: name.trim() });
    // Natural next step: add this cycle's bills.
    go({ name: 'admin-add-bill', cycleId });
  };

  return (
    <Frame>
      <TopBar name={house.display_name} sub="New billing period" admin />
      <div className="screen">
        <ScreenNav />

        <div className="card admin">
          <div className="eyebrow-pill admin">🗂️ New billing period</div>
          <h1 className="title sm">Name this billing period</h1>
          <p className="sub">
            A billing period groups its bills (electricity, water…) so you
            Calculate them together — e.g. <b>June 2026</b>. Different billing
            periods stay separate, even if their dates overlap.
          </p>

          <span className="field-label">Billing period name</span>
          <input
            type="text"
            className="field"
            placeholder="e.g. June 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginTop: 8 }}
            autoFocus
          />

          <button className="btn-primary" disabled={!valid || busy} onClick={create}>
            {busy ? 'Creating…' : 'Create billing period & add bills'}
          </button>
          {error && (
            <p className="muted-note" style={{ color: 'var(--warn-ink)', marginTop: 8 }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </Frame>
  );
}
