import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, Frame, ProgressRow, TopBar } from '../ui';
import { Calendar } from '../Calendar';

type Step = 'welcome' | 'recognize' | 'name' | 'calendar';

/**
 * Member first-tap flow: welcome → recognize-or-name → calendar.
 *
 * Recognition: a real build would skip straight to the calendar for a known
 * device. Since the prototype can't read a device identity, the welcome screen
 * offers both paths — "Continue" (unrecognized → member list) and a dev
 * shortcut that simulates being recognized.
 */
export function MemberJoin() {
  const { house, go, setCurrentMember, addMember } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('Divya');

  const activeMembers = house.members.filter((m) => m.active);

  const pickExisting = (id: string) => {
    setActiveId(id);
    setCurrentMember(id);
    setStep('calendar');
  };

  const joinAsNew = () => {
    const member = addMember(draftName.trim() || 'New member');
    setActiveId(member.id);
    setCurrentMember(member.id);
    setStep('calendar');
  };

  const member = activeId ? house.members.find((m) => m.id === activeId) : null;

  return (
    <Frame>
      <TopBar
        icon="LD"
        name="Lorong Damai 12"
        sub={
          step === 'welcome'
            ? 'Member sign-in'
            : step === 'recognize'
            ? 'Who are you?'
            : step === 'name'
            ? 'New member'
            : (member?.name ?? 'Member')
        }
      />
      <div className="screen">
        {step === 'welcome' && (
          <>
            <ProgressRow total={3} done={1} />
            <div className="card">
              <div className="eyebrow-pill">👋 Welcome</div>
              <h1 className="title">
                Split bills by
                <br />
                <span className="accent">days actually home</span>
              </h1>
              <p className="sub">
                Lorong Damai 12 uses Kongsi Bill so electricity, water, and gas
                split fairly — by who was really there, not split evenly.
              </p>
              <button className="btn-primary" onClick={() => setStep('recognize')}>
                Continue
              </button>
              <button
                className="btn-ghost"
                onClick={() => pickExisting('m-alice')}
                title="Simulates a device that already recognizes the member"
              >
                (dev) I'm a recognized device → skip to calendar
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
                Tap your name so we don't create a duplicate for the same person.
              </p>
              <div style={{ marginTop: 16 }}>
                {activeMembers.map((m) => (
                  <div
                    key={m.id}
                    className="member-row"
                    onClick={() => pickExisting(m.id)}
                  >
                    <Avatar member={m} />
                    <div className="member-name">{m.name}</div>
                  </div>
                ))}
              </div>
              <button className="btn-ghost" onClick={() => setStep('name')}>
                No, I'm new here
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
              Hi {member.name}, mark the days you were home
            </div>
            <Calendar
              memberId={member.id}
              bill={house.bills.find((b) => b.status === 'grace')}
              initial={{ year: 2026, month: 5 }}
            />
            <button
              className="btn-primary"
              onClick={() => go({ name: 'member-landing' })}
            >
              Save my days
            </button>
          </>
        )}
      </div>
    </Frame>
  );
}
