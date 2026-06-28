import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, ExtrapolatedTag, Frame, ScreenNav, TopBar } from '../ui';
import { Calendar } from '../Calendar';
import { ShareCodes } from '../ShareCodes';
import { billIcon, billLabel, formatPeriod, money } from '../calc';
import type { DateRange, Member } from '../types';

// Three landing states the prototype can simulate via the dev toggle. There is
// no "locked" state anymore — bills stay editable regardless of status.
type LandingState = 'none' | 'active' | 'calm';

const STATE_LABELS: Record<LandingState, string> = {
  none: 'No bills',
  active: 'Bills to mark',
  calm: 'Calm',
};

/**
 * Returning-member, state-aware landing. The same member sees a different
 * landing depending on the house state. Extrapolated screen — layout is our
 * own judgment, tokens are the locked design system.
 */
export function MemberLanding() {
  const { house, currentMemberId, go, connected } = useApp();
  const [state, setState] = useState<LandingState>('active');

  // Not joined to any house yet — there's no home page to show.
  if (!connected) {
    return (
      <Frame>
        <TopBar icon="🏡" name="My home page" sub="Not joined yet" />
        <div className="screen">
          <ScreenNav />
          <div className="card">
            <div className="eyebrow-pill">🔗 Join a house first</div>
            <h1 className="title sm">You haven’t joined a house yet</h1>
            <p className="sub">
              Once you join with an invite link or join code, this becomes your
              home page — your bills, your days, and the splits.
            </p>
            <button className="btn-primary" onClick={() => go({ name: 'member-join' })}>
              Join a house
            </button>
            <button className="btn-secondary" onClick={() => go({ name: 'hub' })}>
              Back to start
            </button>
          </div>
        </div>
      </Frame>
    );
  }

  const member =
    house.members.find((m) => m.member_id === currentMemberId) ?? house.members[0];

  if (!member) {
    return (
      <Frame>
        <TopBar icon="LD" name={house.display_name} sub="Home" />
        <div className="screen">
          <ScreenNav />
          <div className="card">
            <div className="eyebrow-pill">No housemates yet</div>
            <p className="sub">Once you’re added to the house you’ll see your bills here.</p>
          </div>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <TopBar icon="LD" name={house.display_name} sub={member.name} />
      <div className="screen">
        <ScreenNav />
        {/* dev-only state simulator */}
        <div className="card" style={{ marginBottom: 14 }}>
          <ExtrapolatedTag />
          <div className="working-title">Dev — simulate house state</div>
          <div className="seg-choice" style={{ flexWrap: 'wrap' }}>
            {(Object.keys(STATE_LABELS) as LandingState[]).map((s) => (
              <div
                key={s}
                className={`opt ${state === s ? 'selected' : ''}`}
                onClick={() => setState(s)}
              >
                {STATE_LABELS[s]}
              </div>
            ))}
          </div>
        </div>

        <div className="greeting-line">
          Hi {member.name}, here's where things stand
        </div>

        {state === 'none' && <NoBills />}
        {state === 'active' && <ActiveBills member={member} />}
        {state === 'calm' && <Calm member={member} />}

        <button className="btn-secondary" onClick={() => go({ name: 'member-history' })}>
          See all bills (everyone)
        </button>

        <ShareCodes />
      </div>
    </Frame>
  );
}

function NoBills() {
  return (
    <div className="card">
      <div className="eyebrow-pill">Nothing to split yet</div>
      <p className="sub">
        No bills have been added. When one arrives you’ll be counted home by
        default — you’ll only mark the days you were away. Nothing to do for now.
      </p>
    </div>
  );
}

function ActiveBills({ member }: { member: Member }) {
  const { house, setPresence, confirmDays, error } = useApp();
  const bills = house.bills;
  const [draft, setDraft] = useState<DateRange[] | null>(null);
  // Pending = the calendar has unsaved edits (so the confirmed badge is stale).
  const [pending, setPending] = useState(false);
  const confirmed = member.days_confirmed && !pending;

  const save = async () => {
    await setPresence(member.member_id, draft ?? member.presence);
    await confirmDays(member.member_id);
    setPending(false);
  };

  return (
    <>
      <div className="prompt-strip">
        <span className="pico">🗓️</span>
        <div>
          {bills.length === 1 ? 'There’s a bill in progress.' : `There are ${bills.length} bills.`}{' '}
          You’re counted home by default — just mark any days you were away. You
          can update your days any time; the split always recomputes.
        </div>
      </div>

      {bills.map((bill) => (
        <div className="card" key={bill.bill_id}>
          <div className="row-between">
            <div>
              <div className="util-label" style={{ fontSize: 12 }}>
                {billLabel(bill)}
              </div>
              <div className="util-amount tnum" style={{ fontSize: 22 }}>
                {money(bill.amount)}
              </div>
              <div className="util-period">{formatPeriod(bill)}</div>
            </div>
            <div className="bill-icon">{billIcon(bill)}</div>
          </div>
        </div>
      ))}

      <Calendar
        memberId={member.member_id}
        bills={bills}
        initial={{ year: 2026, month: 4 }}
        onChange={(r) => {
          setDraft(r);
          setPending(true);
        }}
      />
      <p className="muted-note" style={{ textAlign: 'center', marginTop: 4 }}>
        Orange = counted home. Tap a day to mark yourself away — each bill counts
        only the dates in its own period.
      </p>

      {confirmed ? (
        <div className="recon-strip ok" style={{ marginTop: 14 }}>
          <span>✓</span>
          <div>
            You’ve marked your days correct — the admin can see you’re done. Edit
            any day above any time before a bill is paid (you’ll just mark
            them correct again).
          </div>
        </div>
      ) : (
        <button className="btn-primary" onClick={save}>
          {member.days_confirmed ? 'Save changes & mark correct' : 'These are right — mark my days correct'}
        </button>
      )}
      {error && (
        <p className="muted-note" style={{ color: 'var(--warn-ink)', marginTop: 8 }}>
          {error}
        </p>
      )}
    </>
  );
}

function Calm({ member }: { member: Member }) {
  return (
    <div className="card">
      <div className="eyebrow-pill">All caught up</div>
      <h1 className="title sm">Nothing needs you right now</h1>
      <p className="sub">
        Nothing to mark. When the next bill arrives you’ll be counted home by
        default — you’ll only need to note any days you were away.
      </p>
      <div className="row-between" style={{ marginTop: 16 }}>
        <div className="person-left">
          <Avatar member={member} size="md" />
          <div className="person-name">{member.name}</div>
        </div>
      </div>
    </div>
  );
}
