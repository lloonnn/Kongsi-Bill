import { useState } from 'react';
import { useApp } from '../store';
import { Frame, ScreenNav, TopBar } from '../ui';

/**
 * Admin access (the `/manage` path). The PIC types their admin code here to
 * unlock the house's admin area — the code is never embedded in a link, so it
 * arrives by hand each time (blueprint §5.3 / DOCUMENTATION "manage page").
 *
 * UI ONLY for now: submitting just logs the typed value. Validation, the
 * X-Admin-Code check against the Worker, and navigation on success are wired in
 * a later task — deliberately kept out of here so the screen can be verified in
 * isolation. Plain text input (not masked) matches how the admin code is shown
 * elsewhere (e.g. AdminSetup) and the project's no-password model.
 */
export function AdminManage() {
  const [code, setCode] = useState('');
  // Reserved inline-error slot. Stays null for now; real error text (wrong /
  // missing code) is wired in the next task.
  const [formError] = useState<string | null>(null);

  const submit = () => {
    // No store/api calls and no navigation yet — log only.
    console.log('[AdminManage] admin code entered:', code.trim());
  };

  return (
    <Frame>
      <TopBar icon="🔑" name="Manage house" sub="Enter your admin code" admin />
      <div className="screen">
        <ScreenNav />

        <div className="card admin">
          <div className="eyebrow-pill admin">🔑 Admin access</div>
          <h1 className="title sm">Enter your admin code</h1>
          <p className="sub">
            Type the admin key you saved when you set up the house. It proves
            you're the bill-payer — it's never put in a link, so you enter it by
            hand here.
          </p>

          <input
            type="text"
            className="field"
            placeholder="Admin code — e.g. QRP-9034"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />

          {/* Reserved inline-error area — empty until wired in the next task. */}
          <p
            className="muted-note"
            style={{ color: 'var(--warn-ink)', marginTop: 8, minHeight: '1.25em' }}
            role="alert"
            aria-live="polite"
          >
            {formError}
          </p>

          <button className="btn-primary" disabled={!code.trim()} onClick={submit}>
            Continue
          </button>
        </div>
      </div>
    </Frame>
  );
}
