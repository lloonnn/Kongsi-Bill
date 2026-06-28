import { useState } from 'react';
import { useApp } from '../store';
import { exportHistory, exportLatest } from '../export';
import { ExtrapolatedTag, Frame, ScreenNav, TopBar } from '../ui';

/** Export the split to a .csv file. One table per billing period. */
export function AdminExport() {
  const { house } = useApp();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (what: string, fn: () => void) => {
    setError(null);
    try {
      fn();
      setDone(what);
      setTimeout(() => setDone((d) => (d === what ? null : d)), 2200);
    } catch (e) {
      setDone(null);
      setError(e instanceof Error ? e.message : 'Export failed.');
    }
  };

  return (
    <Frame>
      <TopBar icon="LD" name={house.display_name} sub="Export" admin />
      <div className="screen">
        <ScreenNav />
        <div className="card admin">
          <ExtrapolatedTag />
          <div className="eyebrow-pill admin">📤 Export</div>
          <h1 className="title sm">Export the numbers</h1>
          <p className="sub">
            Pull the split out as a spreadsheet for your records or to share —
            one table per billing cycle.
          </p>

          {done && (
            <div className="recon-strip ok" style={{ marginTop: 16 }}>
              <span>✓</span>
              <div>Exported {done} — check your downloads.</div>
            </div>
          )}
          {error && (
            <div className="recon-strip warn" style={{ marginTop: 16 }}>
              <span>!</span>
              <div>{error}</div>
            </div>
          )}

          <button
            className="btn-primary"
            onClick={() => run('latest cycle', () => exportLatest(house))}
          >
            Export latest cycle
          </button>
          <button
            className="btn-secondary"
            onClick={() => run('full history', () => exportHistory(house))}
          >
            Export full history
          </button>
        </div>
      </div>
    </Frame>
  );
}
