import { useState } from 'react';
import { useApp } from './store';
import { copyText } from './clipboard';
import { buildJoinCode } from './joinCode';

/**
 * Share card — copy the join link or the join code to invite another
 * housemate. Anyone in the house can use it (not just the bill-payer).
 */
export function ShareCodes({ title = 'Invite a housemate' }: { title?: string }) {
  const { house } = useApp();
  const [copied, setCopied] = useState<string | null>(null);

  // Same-origin join link — built from the current location so it always points
  // at wherever the app is served, never a hardcoded domain.
  const link = `${window.location.origin}/join?house=${house.house_id}&code=${house.member_code}`;
  // The "no link" fallback: one combined join code that bundles the house id and
  // member code, so the house id is never shared as a separate value.
  const joinCode = buildJoinCode(house.house_id, house.member_code);

  const flash = async (id: string, text: string) => {
    const ok = await copyText(text);
    if (!ok) return; // don't claim success if the clipboard write failed
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1200);
  };

  return (
    <div className="card">
      <div className="working-title">{title}</div>

      <div className="code-zone member-zone">
        <div className="code-zone-label">Join link</div>
        <div className="link-zone" style={{ marginTop: 8, background: '#fff' }}>
          <span className="link-text">{link}</span>
          <button className="copy-btn" onClick={() => flash('link', link)}>
            {copied === 'link' ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="code-zone member-zone">
        <div className="code-zone-label">Or the join code</div>
        <div className="code-with-copy">
          <span className="code-zone-value">{joinCode}</span>
          <button className="copy-btn" onClick={() => flash('code', joinCode)}>
            {copied === 'code' ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <div className="code-zone-hint">
          Both lead to the same house — send whichever is easier.
        </div>
      </div>
    </div>
  );
}
