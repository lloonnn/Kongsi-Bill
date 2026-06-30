import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, Frame, ScreenNav, TopBar } from '../ui';
import { Calendar } from '../Calendar';
import { ShareCodes } from '../ShareCodes';
import { billIcon, billLabel, formatPeriod, money } from '../calc';
import type { DateRange, Member } from '../types';

// The member home page shows one of three states, derived from the house's
// bills (no manual toggle):
//   none   — no bills yet
//   active — at least one bill still open (not paid) → mark/confirm your days
//   calm   — bills exist but all settled (paid) → nothing to do right now
type LandingState = 'none' | 'active' | 'calm';

/** {year, month} (0-based) for the calendar to open on, from an ISO date. */
function monthOf(iso: string | undefined): { year: number; month: number } {
  const d = iso ? new Date(iso + 'T00:00:00') : new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * Returning-member, state-aware landing. The same member sees a different
 * landing depending on the house state. Extrapolated screen — layout is our
 * own judgment, tokens are the locked design system.
 */
export function MemberLanding() {
  const { house, currentMemberId, go, connected } = useApp();

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
        <TopBar name={house.display_name} sub="Home" />
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

  // Derive the landing state from real data — no manual toggle.
  const openBills = house.bills.filter((b) => b.status !== 'paid');
  const state: LandingState =
    house.bills.length === 0 ? 'none' : openBills.length > 0 ? 'active' : 'calm';

  return (
    <Frame>
      <TopBar name={house.display_name} sub={member.name} />
      <div className="screen">
        <ScreenNav />

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
      <div className="eyebrow-pill">No bills yet</div>
      <p className="sub">
        Your house hasn’t added any bills yet. When the first one arrives you’ll
        be counted home by default — you’ll only mark the days you were away.
      </p>
    </div>
  );
}

function ActiveBills({ member }: { member: Member }) {
  const { house, setPresence, confirmDays, error } = useApp();
  const bills = house.bills;
  // Open the calendar on the earliest bill's period so the dotted days are visible.
  const initialView = monthOf([...bills].map((b) => b.period_start).sort()[0]);
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
      {/* State header — makes "still to confirm" vs "confirmed" obvious at a
          glance (the two looked near-identical, differing only at the bottom).
          Display only: driven by the existing `confirmed` flag. */}
      <div className="eyebrow-pill">{confirmed ? '✓ Days confirmed' : '🗓️ Action needed'}</div>
      <h1 className="title sm" style={{ marginTop: 6 }}>
        {confirmed ? 'You’re all set for now' : 'Which days were you away?'}
      </h1>

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
        initial={initialView}
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
      <div className="eyebrow-pill">All settled</div>
      <h1 className="title sm">Nothing needs you right now</h1>
      <p className="sub">
        Your bills are all settled — nothing to mark. You’ll get a nudge here
        when the next bill is added.
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
