import { useState } from 'react';
import { useApp } from '../store';
import { ApiError } from '../api';
import { Frame, ScreenNav, TopBar } from '../ui';

/**
 * Admin access (the `/manage` path). The PIC types their admin code here to
 * unlock the house's admin area — the code is never embedded in a link, so it
 * arrives by hand each time (blueprint §5.3 / DOCUMENTATION "manage page").
 *
 * Submit verifies the typed house id + admin code against the live Worker
 * (becomeAdmin → GET /house/:id with the code as X-Admin-Code) and, on success,
 * seeds the session's adminCode and navigates into the admin dashboard. Plain
 * text input (not masked) matches how the admin code is shown elsewhere (e.g.
 * AdminSetup) and the project's no-password model.
 */
export function AdminManage() {
  const { becomeAdmin, go } = useApp();
  const [houseId, setHouseId] = useState('');
  const [code, setCode] = useState('');
  // Inline error slot — empty until a submit fails (offline / wrong code / etc.).
  const [formError, setFormError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const submit = async () => {
    const houseTrimmed = houseId.trim();
    const trimmed = code.trim();
    if (!houseTrimmed || !trimmed) return; // safety; button disabled until both filled

    // Offline guard FIRST — never attempt the network when the device has no
    // connectivity. (House id is typed, so no prior session is needed; only a
    // genuine lack of network blocks here.)
    if (!navigator.onLine) {
      setFormError("Can't verify your code while offline. Reconnect and try again.");
      return; // no API call, no adminCode mutation, no navigation
    }

    setVerifying(true);
    setFormError(null);
    try {
      // GET /house/:id with X-Admin-Code = trimmed. On success the store seeds
      // adminCode + attaches the house to the session; on rejection it throws
      // and seeds nothing.
      await becomeAdmin(houseTrimmed, trimmed);
      // Verified: session is seeded with the house + admin code. Enter the admin
      // area. Only reached on success — failures/offline return before here.
      console.log('[AdminManage] admin code verified — session seeded, entering dashboard');
      go({ name: 'admin-dashboard' });
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setFormError("That admin code didn't match this house. Check it and try again.");
      } else if (e instanceof ApiError && e.status === 404) {
        setFormError('House not found — it may have been removed.');
      } else if (e instanceof ApiError) {
        setFormError(`Couldn't verify your code (error ${e.status}). Please try again.`);
      } else {
        // Non-ApiError = the fetch itself failed (network/server unreachable).
        setFormError("Couldn't reach the server. Check your connection and try again.");
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Frame>
      <TopBar icon="🔑" name="Manage house" sub="Enter your admin code" admin />
      <div className="screen">
        <ScreenNav />

        <div className="card admin">
          <div className="eyebrow-pill admin">🔑 Admin access</div>
          <h1 className="title sm">Enter your house ID and admin code</h1>
          <p className="sub">
            Type the house ID and the admin key you saved when you set up the
            house. They prove you're the bill-payer — neither is ever put in a
            link, so you enter them by hand here.
          </p>

          <input
            type="text"
            className="field"
            placeholder="House ID — e.g. ABCD-1234"
            value={houseId}
            onChange={(e) => {
              setHouseId(e.target.value);
              setFormError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />

          <input
            type="text"
            className="field"
            placeholder="Admin code — e.g. ABC-1234"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setFormError(null);
            }}
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

          <button
            className="btn-primary"
            disabled={!houseId.trim() || !code.trim() || verifying}
            onClick={submit}
          >
            {verifying ? 'Verifying…' : 'Continue'}
          </button>
        </div>
      </div>
    </Frame>
  );
}
