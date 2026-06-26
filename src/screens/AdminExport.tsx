import { useState } from 'react';
import { useApp } from '../store';
import { ExtrapolatedTag, Frame, ScreenNav, TopBar } from '../ui';

/** Mock export flow — no real XLSX, just a confirmation. Extrapolated. */
export function AdminExport() {
  const { house } = useApp();
  const [done, setDone] = useState<string | null>(null);

  const exportIt = (what: string) => {
    setDone(what);
    setTimeout(() => setDone((d) => (d === what ? null : d)), 2200);
  };

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="Export" admin />
      <div className="screen">
        <ScreenNav />
        <div className="card admin">
          <ExtrapolatedTag />
          <div className="eyebrow-pill admin">📤 Export</div>
          <h1 className="title sm">Export the numbers</h1>
          <p className="sub">
            Pull the split out for your records or to paste into a group chat.
            (Prototype: this just confirms — no file is generated.)
          </p>

          {done && (
            <div className="recon-strip ok" style={{ marginTop: 16 }}>
              <span>✓</span>
              <div>Exported {done} — check your downloads (pretend).</div>
            </div>
          )}

          <button className="btn-primary" onClick={() => exportIt('latest bill')}>
            Export latest bill
          </button>
          <button className="btn-secondary" onClick={() => exportIt('full history')}>
            Export full history
          </button>
        </div>
      </div>
    </Frame>
  );
}
