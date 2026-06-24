import { useState } from 'react';
import { useApp } from '../store';
import { BackLink, ExtrapolatedTag, Frame, TopBar } from '../ui';

/** Regenerate a leaked member code. Extrapolated admin utility. */
export function AdminRegenerate() {
  const { house, back, regenerateMemberCode } = useApp();
  const [fresh, setFresh] = useState<string | null>(null);

  const regen = () => setFresh(regenerateMemberCode());

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="Regenerate code" admin />
      <div className="screen">
        <BackLink onClick={back} />
        <div className="card admin">
          <ExtrapolatedTag />
          <div className="eyebrow-pill admin">🔑 Code hygiene</div>
          <h1 className="title sm">Regenerate the member code</h1>
          <p className="sub">
            If the join link leaked outside the house, rotate the member code. The
            old code stops working immediately — re-share the new link with
            housemates.
          </p>

          <div className="code-zone member-zone">
            <div className="code-zone-label">Current member code</div>
            <div className="code-zone-value">{house.memberCode}</div>
            <div className="code-zone-hint">Travels in the join link.</div>
          </div>

          {fresh && (
            <div className="recon-strip ok" style={{ marginTop: 16 }}>
              <span>✓</span>
              <div>
                New code is <b>{fresh}</b>. The old code no longer works — logged
                to the change log.
              </div>
            </div>
          )}

          <button className="btn-primary" onClick={regen}>
            Regenerate member code
          </button>
          <p className="muted-note" style={{ textAlign: 'center', marginTop: 10 }}>
            The admin code is never rotated here — it never travels in a link.
          </p>
        </div>
      </div>
    </Frame>
  );
}
