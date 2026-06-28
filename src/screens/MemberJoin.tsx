import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { Avatar, Frame, ProgressRow, ScreenNav, TopBar } from '../ui';
import { Calendar } from '../Calendar';
import type { DateRange } from '../types';

type Step = 'code' | 'welcome' | 'recognize' | 'name' | 'calendar';

/**
 * Normalize a typed code/room-id to the *stored* format so lenient typing still
 * matches D1 exactly. The Worker compares codes with `===` (case-sensitive,
 * dashes included) and stores them upper-cased and grouped in 4s ("XW08-BCBN"),
 * so we upper-case and re-insert a dash every 4 chars — NOT strip the dashes.
 */
function normalizeCode(s: string): string {
  const clean = s.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return clean.replace(/(.{4})(?=.)/g, '$1-');
}

/**
 * Read the invite (house id + member code) from the join link's query string,
 * if present. This is the source of truth on a cold device — the link works on
 * any device because the house + code travel in the URL, not in local state.
 */
function readInvite(): { house: string; code: string } | null {
  const params = new URLSearchParams(window.location.search);
  const house = params.get('house');
  const code = params.get('code');
  return house && code ? { house, code } : null;
}

/**
 * Housemate join flow.
 *
 * Entry from the in-app "Join a house" button starts at the code step (they
 * don't have a house attached yet). Tapping the invite link instead would
 * arrive with the code already in the URL and skip straight to "welcome".
 *   code → welcome → recognize-or-name → calendar
 */
export function MemberJoin() {
  const { house, go, setCurrentMember, addMember, setPresence, confirmDays, joinHouse, error } =
    useApp();
  // Read the invite once on mount so it stays stable across re-renders (the lazy
  // useState initializer runs readInvite exactly once; reading state in render is
  // fine, unlike reading a ref's .current).
  const [invite] = useState(readInvite);
  const [step, setStep] = useState<Step>('code');
  // Pre-fill from the link so a failed auto-join leaves both fields ready to
  // retry by hand. A hand-typed code can't identify the house, so the manual
  // form also needs the house/room id (the link carries both).
  const [houseInput, setHouseInput] = useState(invite?.house ?? '');
  const [codeInput, setCodeInput] = useState(invite?.code ?? '');
  const [codeError, setCodeError] = useState(false);

  // Invite-link arrival (cold device): join straight from the URL params, with
  // no dependence on any pre-existing local state, then drop into the flow —
  // skipping the manual code step. On failure we fall back to the code step
  // (the code is already pre-filled) so the user can retry by hand.
  useEffect(() => {
    if (!invite) return;
    let cancelled = false;
    joinHouse(invite.house, invite.code)
      .then(() => {
        if (!cancelled) setStep('welcome');
      })
      .catch(() => {
        if (!cancelled) setCodeError(true);
      });
    return () => {
      cancelled = true;
    };
    // Run once on mount; `invite` is read-once and stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While the link-based join is in flight (invite present, still on the code
  // step, no failure yet) show a "Joining…" placeholder instead of the manual
  // code form — the code came from the URL, so there's nothing to type.
  const joiningFromLink = !!invite && step === 'code' && !codeError;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('Divya');
  const [presenceDraft, setPresenceDraft] = useState<DateRange[] | null>(null);

  const activeMembers = house.members.filter((m) => m.active);
  const member = activeId ? house.members.find((m) => m.member_id === activeId) : null;

  // Manual entry: join the REAL house via the API (same path as the link), not
  // a local mock comparison. The house id + member code both come from the form.
  const submitCode = async () => {
    const houseId = normalizeCode(houseInput);
    const code = normalizeCode(codeInput);
    if (!houseId || !code) return;
    try {
      await joinHouse(houseId, code); // GET /api/house/:id with X-Member-Code
      setCodeError(false);
      setStep('welcome');
    } catch {
      setCodeError(true);
    }
  };

  const pickExisting = (id: string) => {
    setActiveId(id);
    setCurrentMember(id);
    setStep('calendar');
  };

  const joinAsNew = async () => {
    const m = await addMember(draftName.trim() || 'New member');
    setActiveId(m.member_id);
    setCurrentMember(m.member_id);
    setStep('calendar');
  };

  const saveDays = async () => {
    if (member) {
      await setPresence(member.member_id, presenceDraft ?? member.presence);
      await confirmDays(member.member_id);
    }
    go({ name: 'member-landing' });
  };

  // back control: first step exits to Home, otherwise steps backward
  const prev: Record<Step, () => void> = {
    code: () => go({ name: 'hub' }),
    welcome: () => setStep('code'),
    recognize: () => setStep('welcome'),
    name: () => setStep('recognize'),
    calendar: () => setStep('recognize'),
  };

  const subs: Record<Step, string> = {
    code: 'Enter your join code',
    welcome: 'Joining',
    recognize: 'Who are you?',
    name: 'New here',
    calendar: member?.name ?? 'Member',
  };

  return (
    <Frame>
      <TopBar
        icon={step === 'code' ? '🔗' : 'LD'}
        name={step === 'code' ? 'Join a house' : house.display_name}
        sub={subs[step]}
      />
      <div className="screen">
        <ScreenNav onBack={step === 'code' ? undefined : prev[step]} />

        {step === 'code' && joiningFromLink && (
          <div className="card">
            <div className="eyebrow-pill">🔗 Joining…</div>
            <h1 className="title sm">Opening your house…</h1>
            <p className="sub">Joining from your invite link — one moment.</p>
          </div>
        )}

        {step === 'code' && !joiningFromLink && (
          <div className="card">
            <div className="eyebrow-pill">🔗 Join a house</div>
            <h1 className="title sm">Enter your house ID and code</h1>
            <p className="sub">
              Enter the house ID and join code your housemates shared with you.
              Both are in the invite link — you only need to type them if you
              don’t have the link.
            </p>
            <input
              type="text"
              className="field"
              placeholder="House ID — e.g. XW08-BCBN"
              value={houseInput}
              onChange={(e) => {
                setHouseInput(e.target.value);
                setCodeError(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitCode()}
            />
            <input
              type="text"
              className="field"
              placeholder="Join code — e.g. XYZ-4821"
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value);
                setCodeError(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitCode()}
            />
            {codeError && (
              <p className="muted-note" style={{ color: 'var(--warn-ink)', marginTop: 8 }}>
                That house ID and code didn’t match a house. Check them and try again.
              </p>
            )}
            <button
              className="btn-primary"
              disabled={!houseInput.trim() || !codeInput.trim()}
              onClick={submitCode}
            >
              Join
            </button>
          </div>
        )}

        {step === 'welcome' && (
          <>
            <ProgressRow total={3} done={1} />
            <div className="card">
              <div className="eyebrow-pill">✓ House found</div>
              <h1 className="title">
                You’re joining
                <br />
                <span className="accent">{house.display_name}</span>
              </h1>
              <p className="sub">
                Bills here are split by how many days each person was home.
                You’re counted home by default, just mark the days you were
                away, and you only pay for the days you were here.
              </p>
              <button className="btn-primary" onClick={() => setStep('recognize')}>
                Continue
              </button>
            </div>
          </>
        )}

        {step === 'recognize' && (
          <>
            <ProgressRow total={3} done={2} />
            <div className="card">
              <h1 className="title sm">
                Are you one
                <br />
                of these?
              </h1>
              <p className="sub">
                Tap your name so we don’t create a duplicate for the same person.
              </p>
              <div style={{ marginTop: 16 }}>
                {activeMembers.map((m) => (
                  <div key={m.member_id} className="member-row" onClick={() => pickExisting(m.member_id)}>
                    <Avatar member={m} />
                    <div className="member-name">{m.name}</div>
                  </div>
                ))}
              </div>
              <button className="btn-ghost" onClick={() => setStep('name')}>
                No, I’m new here
              </button>
            </div>
          </>
        )}

        {step === 'name' && (
          <>
            <ProgressRow total={3} done={3} />
            <div className="card">
              <h1 className="title sm">
                What should
                <br />
                we call you?
              </h1>
              <p className="sub">So housemates know whose days are whose.</p>
              <input
                type="text"
                className="field"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Your name"
              />
              <button className="btn-primary" onClick={joinAsNew}>
                Join the house
              </button>
            </div>
          </>
        )}

        {step === 'calendar' && member && (
          <>
            <div className="greeting-line">
              Hi {member.name}, mark any days you were away
            </div>
            <Calendar
              memberId={member.member_id}
              bills={house.bills}
              initial={{ year: 2026, month: 5 }}
              onChange={setPresenceDraft}
            />
            <button className="btn-primary" onClick={saveDays}>
              Save &amp; mark my days correct
            </button>
            {error && (
              <p className="muted-note" style={{ color: 'var(--warn-ink)', marginTop: 8 }}>
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </Frame>
  );
}
