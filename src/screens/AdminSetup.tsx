import { useState } from 'react';
import { useApp } from '../store';
import { Frame, houseInitials, ProgressRow, ScreenNav, TopBar } from '../ui';
import { copyText } from '../clipboard';
import type { AvatarTone } from '../types';

const TONES: AvatarTone[] = ['accent', 'alt2', 'alt3'];
function toneClass(i: number) {
  const t = TONES[i % TONES.length];
  return t === 'alt2' ? 'alt2' : t === 'alt3' ? 'alt3' : '';
}

/**
 * Admin house-creation flow (Journey A):
 * name → codes generated → save-codes (weighted) → add housemates → share link.
 * Self-contained local state — it's the "new house" setup, separate from the
 * running mock house. Finishing drops into the mock house dashboard.
 */
export function AdminSetup() {
  const { go, createHouse, addMember, busy, error } = useApp();
  const [step, setStep] = useState(1);
  const [houseName, setHouseName] = useState('');
  const [codesSaved, setCodesSaved] = useState(false);
  // Start empty: the creator is NOT auto-added. They’re prompted to add
  // themselves (among others) — a house may even validly have no PIC member.
  const [members, setMembers] = useState<string[]>([]);
  const [newMember, setNewMember] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  // Real codes returned by POST /house, captured at step 1.
  const [created, setCreated] = useState<{
    house_id: string;
    member_code: string;
    admin_code: string;
  } | null>(null);

  // Join link shared on the final step (matches what's rendered there). Built
  // same-origin from the current location so it always points at wherever the
  // app is actually served — never a hardcoded domain.
  const joinLink = created
    ? `${window.location.origin}/join?house=${created.house_id}&code=${created.member_code}`
    : '';

  const markCopied = (id: string) => {
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1200);
  };

  const flash = async (id: string, text: string) => {
    const ok = await copyText(text);
    if (!ok) return; // don't claim success if the clipboard write failed
    markCopied(id);
  };

  // Download the admin key as a small text file so it can't be lost.
  const downloadBackup = () => {
    if (!created) return;
    const body =
      `Kongsi Bill — admin backup\n\n` +
      `House: ${houseName}\n` +
      `House ID: ${created.house_id}\n` +
      `Join code: ${created.member_code}\n` +
      `Admin key (keep private): ${created.admin_code}\n`;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `kongsi-bill-${created.house_id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    markCopied('dl');
  };

  const addToList = () => {
    const v = newMember.trim();
    if (!v) return;
    setMembers((m) => [...m, v]);
    setNewMember('');
  };

  const createTheHouse = async () => {
    const res = await createHouse(houseName.trim());
    setCreated({
      house_id: res.house_id,
      member_code: res.member_code,
      admin_code: res.admin_code,
    });
    setStep(2);
  };

  const persistMembersAndShare = async () => {
    for (const name of members) await addMember(name);
    setStep(5);
  };

  const subs: Record<number, string> = {
    1: 'Step 1 of 5',
    2: 'Step 2 of 5',
    3: 'Step 3 of 5 — the important one',
    4: 'Step 4 of 5',
    5: 'Step 5 of 5 — ready to share',
  };

  return (
    <Frame>
      <TopBar
        icon={step === 1 ? '+' : houseInitials(houseName)}
        name={step === 1 ? 'New house' : houseName}
        sub={subs[step]}
        admin
      />
      <div className="screen">
        <ScreenNav onBack={step === 1 ? undefined : () => setStep((s) => s - 1)} />
        <ProgressRow total={5} done={step} admin />

        {step === 1 && (
          <div className="card admin">
            <div className="eyebrow-pill admin">🏠 Create your house</div>
            <h1 className="title">
              What's this
              <br />
              house called?
            </h1>
            <p className="sub">
              Housemates will see this name. Use your address or a nickname —
              whatever your group already calls it.
            </p>
            <input
              type="text"
              className="field"
              placeholder="Your house name or address"
              value={houseName}
              onChange={(e) => setHouseName(e.target.value)}
            />
            <button
              className="btn-primary"
              onClick={createTheHouse}
              disabled={!houseName.trim() || busy}
            >
              {busy ? 'Creating…' : 'Create house'}
            </button>
            {error && (
              <p className="muted-note" style={{ color: 'var(--warn-ink)', marginTop: 8 }}>
                {error}
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="card admin">
            <div className="eyebrow-pill admin">✓ House created</div>
            <h1 className="title">Two things to know</h1>
            <p className="sub">
              One you share so people can join. One you keep to yourself.
            </p>

            <div className="code-zone member-zone">
              <div className="code-zone-label">1 · Share this — the join code</div>
              <div className="code-with-copy">
                <span className="code-zone-value">{created?.member_code ?? '…'}</span>
                <button
                  className="copy-btn"
                  onClick={() => flash('code', created?.member_code ?? '')}
                >
                  {copied === 'code' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="code-zone-hint">
                Housemates use this to join. On the last step you'll get a
                tap-to-join link that serves as an alternative way to join your house.
              </div>
            </div>

            <div className="code-zone admin-zone">
              <div className="code-zone-label">2 · Keep private — your admin key</div>
              <div className="code-zone-value">{created?.admin_code ?? '…'}</div>
              <div className="code-zone-hint">
                Proves you're the one who runs this house. You'll need it to
                mark bills paid, and to add or remove housemates.
              </div>
            </div>

            <button className="btn-primary" onClick={() => setStep(3)}>
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="card admin">
            <div className="warn-strip">
              ⚠️ This is the one step you can't undo later
            </div>
            <h1 className="title sm">
              Save your admin key
              <br />
              before continuing
            </h1>
            <p className="sub">
              If you lose your admin key and no one else has it, no one can get
              you back into this house. Copy it somewhere safe, or download a
              backup.
            </p>

            <div className="action-row">
              <button
                className="action-btn"
                onClick={() => flash('copy', created?.admin_code ?? '')}
              >
                {copied === 'copy' ? '✓ Copied' : '📋 Copy admin key'}
              </button>
              <button className="action-btn" onClick={downloadBackup}>
                {copied === 'dl' ? '✓ Downloaded' : '⬇ Download backup'}
              </button>
            </div>

            <label className="confirm-row">
              <input
                type="checkbox"
                checked={codesSaved}
                onChange={(e) => setCodesSaved(e.target.checked)}
              />
              <span className="confirm-text">
                I've saved my admin key somewhere safe outside this app
              </span>
            </label>

            {/* genuinely disabled until the box is checked */}
            <button
              className="btn-primary"
              disabled={!codesSaved}
              onClick={() => setStep(4)}
            >
              Continue
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="card admin">
            <div className="eyebrow-pill admin">👥 Add housemates</div>
            <h1 className="title sm">Who lives at {houseName}?</h1>
            <p className="sub">
              Add everyone who lives here. You can add or remove people anytime
              later.
            </p>

            <div className="prompt-strip" style={{ marginTop: 12 }}>
              <span className="pico">👋</span>
              <div>
                Add <b>yourself</b> first if you are also contribute to the bills
                too. (You hold the admin key, but you’re not added automatically.)
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              {members.length === 0 && (
                <p className="muted-note" style={{ marginBottom: 8 }}>
                  No housemates added yet — start with your own name.
                </p>
              )}
              {members.map((m, i) => (
                <div className="member-pill" key={m + i}>
                  <div className="left">
                    <div className={`avatar sm ${toneClass(i)}`}>{m[0]}</div>
                    <div className="name">{m}</div>
                  </div>
                  <button
                    className="remove-x"
                    onClick={() => setMembers((arr) => arr.filter((_, j) => j !== i))}
                    aria-label={`Remove ${m}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="add-member-row">
              <input
                type="text"
                className="field"
                placeholder="Add a housemate's name"
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addToList()}
              />
              <button onClick={addToList} aria-label="Add housemate">
                +
              </button>
            </div>

            <button className="btn-primary" onClick={persistMembersAndShare} disabled={busy}>
              {busy ? 'Saving…' : members.length === 0 ? 'Skip for now' : 'Continue'}
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="card admin">
            <div className="eyebrow-pill admin">🔗 Ready to go</div>
            <h1 className="title sm">Invite your house</h1>
            <p className="sub">
              Two ways to join the same house — send whichever is easier.
            </p>

            <div className="code-zone member-zone">
              <div className="code-zone-label">Easiest — tap-to-join link</div>
              <div
                className="link-zone"
                style={{ marginTop: 8, background: '#fff' }}
              >
                <span className="link-text">{joinLink || '…'}</span>
                <button className="copy-btn" onClick={() => flash('link', joinLink)}>
                  {copied === 'link' ? '✓' : 'Copy'}
                </button>
              </div>
              <div className="code-zone-hint">
                Paste it in the group chat — one tap and they're in, no typing.
              </div>
            </div>

            <div className="code-zone member-zone">
              <div className="code-zone-label">No link? — the join code</div>
              <div className="code-with-copy">
                <span className="code-zone-value">{created?.member_code ?? '…'}</span>
                <button
                  className="copy-btn"
                  onClick={() => flash('code', created?.member_code ?? '')}
                >
                  {copied === 'code' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="code-zone-hint">
                They open Kongsi Bill, tap “Join a house”, and type this. It's the
                same code that's already inside the link above.
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={() => go({ name: 'admin-dashboard' })}
            >
              Done — go to house
            </button>
          </div>
        )}

      </div>
    </Frame>
  );
}
