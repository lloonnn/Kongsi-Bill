import { useState } from 'react';
import { useApp } from '../store';
import { Frame, ProgressRow, TopBar } from '../ui';
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
  const { go } = useApp();
  const [step, setStep] = useState(1);
  const [houseName, setHouseName] = useState('Lorong Damai 12');
  const [codesSaved, setCodesSaved] = useState(false);
  const [members, setMembers] = useState(['Alice', 'Bob', 'Carol']);
  const [newMember, setNewMember] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const flash = (id: string) => {
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1200);
  };

  const addMember = () => {
    const v = newMember.trim();
    if (!v) return;
    setMembers((m) => [...m, v]);
    setNewMember('');
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
        icon={step === 1 ? '+' : 'LD'}
        name={step === 1 ? 'New house' : houseName}
        sub={subs[step]}
        admin
      />
      <div className="screen">
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
              value={houseName}
              onChange={(e) => setHouseName(e.target.value)}
            />
            <button
              className="btn-primary"
              onClick={() => setStep(2)}
              disabled={!houseName.trim()}
            >
              Create house
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="card admin">
            <div className="eyebrow-pill admin">✓ House created</div>
            <h1 className="title">
              Here are your
              <br />
              house codes
            </h1>
            <p className="sub">
              Two codes control access. The next step is saving them — there's no
              recovery if both are lost.
            </p>

            <div className="code-zone">
              <div className="code-zone-label">Room ID</div>
              <div className="code-zone-value">LD12-7F2</div>
            </div>
            <div className="code-zone member-zone">
              <div className="code-zone-label">Member code · share freely</div>
              <div className="code-zone-value">XYZ-4821</div>
              <div className="code-zone-hint">
                Goes in the join link, lives in your group chat.
              </div>
            </div>
            <div className="code-zone admin-zone">
              <div className="code-zone-label">Admin code · keep private</div>
              <div className="code-zone-value">QRP-9034</div>
              <div className="code-zone-hint">
                Yours only. Never put this in a link.
              </div>
            </div>

            <button className="btn-primary" onClick={() => setStep(3)}>
              Continue to save codes
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="card admin">
            <div className="warn-strip">
              ⚠️ This is the one step you can't undo later
            </div>
            <h1 className="title sm">
              Save these codes
              <br />
              before continuing
            </h1>
            <p className="sub">
              If you lose both codes with no one else holding them, this house
              can't be recovered. Copy them somewhere safe, or download a backup
              file.
            </p>

            <div className="action-row">
              <button className="action-btn" onClick={() => flash('copy')}>
                {copied === 'copy' ? '✓ Copied' : '📋 Copy all codes'}
              </button>
              <button className="action-btn" onClick={() => flash('dl')}>
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
                I've saved my codes somewhere safe outside this app
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
              Add everyone who'll record presence. You can add or remove people
              anytime later.
            </p>

            <div style={{ marginTop: 16 }}>
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
                onKeyDown={(e) => e.key === 'Enter' && addMember()}
              />
              <button onClick={addMember} aria-label="Add housemate">
                +
              </button>
            </div>

            <button className="btn-primary" onClick={() => setStep(5)}>
              Continue
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="card admin">
            <div className="eyebrow-pill admin">🔗 Ready to go</div>
            <h1 className="title sm">
              Share the join
              <br />
              link with your house
            </h1>
            <p className="sub">
              Paste this into your house group chat. Anyone who taps it joins
              instantly — no typing, no app install.
            </p>

            <div className="link-zone">
              <span className="link-text">
                kongsibill.pages.dev/join?house=LD12-7F2&amp;code=XYZ4821
              </span>
              <button className="copy-btn" onClick={() => flash('link')}>
                {copied === 'link' ? '✓' : 'Copy'}
              </button>
            </div>

            <button
              className="btn-primary"
              onClick={() => go({ name: 'admin-dashboard' })}
            >
              Done — go to house
            </button>
            <button className="btn-ghost" onClick={() => go({ name: 'hub' })}>
              Share house info card instead
            </button>
          </div>
        )}

        {step > 1 && (
          <button className="btn-ghost" onClick={() => setStep((s) => s - 1)}>
            ‹ Back a step
          </button>
        )}
      </div>
    </Frame>
  );
}
