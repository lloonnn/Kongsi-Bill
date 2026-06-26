import { useState } from 'react';
import { useApp } from './store';

/**
 * Share card — copy the join link or the join code to invite another
 * housemate. Anyone in the house can use it (not just the bill-payer).
 */
export function ShareCodes({ title = 'Invite a housemate' }: { title?: string }) {
  const { house } = useApp();
  const [copied, setCopied] = useState<string | null>(null);

  const link = `kongsibill.pages.dev/join?house=${house.house_id}&code=${house.member_code}`;

  const flash = (id: string) => {
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
          <button className="copy-btn" onClick={() => flash('link')}>
            {copied === 'link' ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="code-zone member-zone">
        <div className="code-zone-label">Or the join code</div>
        <div className="code-with-copy">
          <span className="code-zone-value">{house.member_code}</span>
          <button className="copy-btn" onClick={() => flash('code')}>
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
