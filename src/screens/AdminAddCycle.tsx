import { useState } from 'react';
import { useApp } from '../store';
import { ExtrapolatedTag, Frame, ScreenNav, TopBar } from '../ui';

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
      <TopBar icon="LD" name={house.display_name} sub="New cycle" admin />
      <div className="screen">
        <ScreenNav />

        <div className="card admin">
          <ExtrapolatedTag />
          <div className="eyebrow-pill admin">🗂️ New cycle</div>
          <h1 className="title sm">Name this billing cycle</h1>
          <p className="sub">
            A cycle groups one period’s bills (electricity, water…) so you
            Calculate them together — e.g. <b>June 2026</b>. Different cycles stay
            separate, even if their dates overlap.
          </p>

          <span className="field-label">Cycle name</span>
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
            {busy ? 'Creating…' : 'Create cycle & add bills'}
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
