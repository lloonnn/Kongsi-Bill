import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, Frame, ProgressRow, ScreenNav, TopBar } from '../ui';
import { Calendar } from '../Calendar';
import type { DateRange } from '../types';

type Step = 'code' | 'welcome' | 'recognize' | 'name' | 'calendar';

/** Strip spaces/dashes and upper-case so "xyz4821" matches "XYZ-4821". */
function normalizeCode(s: string): string {
  return s.replace(/[^a-z0-9]/gi, '').toUpperCase();
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
  const { house, go, setCurrentMember, addMember, setPresence, confirmDays } = useApp();
  const [step, setStep] = useState<Step>('code');
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('Divya');
  const [presenceDraft, setPresenceDraft] = useState<DateRange[] | null>(null);

  const activeMembers = house.members.filter((m) => m.active);
  const member = activeId ? house.members.find((m) => m.member_id === activeId) : null;

  const submitCode = () => {
    if (normalizeCode(codeInput) === normalizeCode(house.member_code)) {
      setCodeError(false);
      setStep('welcome');
    } else {
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
        name={step === 'code' ? 'Join a house' : 'Lorong Damai 12'}
        sub={subs[step]}
      />
      <div className="screen">
        <ScreenNav onBack={step === 'code' ? undefined : prev[step]} />

        {step === 'code' && (
          <div className="card">
            <div className="eyebrow-pill">🔗 Join a house</div>
            <h1 className="title sm">Enter your join code</h1>
            <p className="sub">
              Enter the code your housemates shared with you to join the house.
            </p>
            <input
              type="text"
              className="field"
              placeholder="e.g. XYZ-4821"
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value);
                setCodeError(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitCode()}
            />
            {codeError && (
              <p className="muted-note" style={{ color: 'var(--warn-ink)', marginTop: 8 }}>
                That code didn’t match a house. Check it and try again.
              </p>
            )}
            <button className="btn-primary" disabled={!codeInput.trim()} onClick={submitCode}>
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
                <span className="accent">Lorong Damai 12</span>
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
          </>
        )}
      </div>
    </Frame>
  );
}
