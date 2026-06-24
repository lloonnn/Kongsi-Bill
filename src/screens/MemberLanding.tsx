import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, ExtrapolatedTag, Frame, TopBar } from '../ui';
import { Calendar } from '../Calendar';
import { WorkingCard } from '../BillBreakdown';
import {
  daysInPeriod,
  daysUntil,
  formatPeriod,
  money,
  NO_ROUNDING,
  UTILITY_META,
} from '../calc';

// Four landing states the prototype can simulate via the dev toggle.
type LandingState = 'none' | 'grace' | 'locked' | 'calm';

const STATE_LABELS: Record<LandingState, string> = {
  none: 'No bills',
  grace: 'Grace nudge',
  locked: 'Just locked',
  calm: 'Calm',
};

/**
 * Returning-member, state-aware landing. The same member sees a different
 * landing depending on the house state. Extrapolated screen — layout is our
 * own judgment, tokens are the locked design system.
 */
export function MemberLanding() {
  const { house, currentMemberId, go } = useApp();
  const [state, setState] = useState<LandingState>('grace');

  const member = house.members.find((m) => m.id === currentMemberId) ?? house.members[0];
  const graceBill = house.bills.find((b) => b.status === 'grace');
  const lockedBill = house.bills.find((b) => b.status === 'locked');

  return (
    <Frame>
      <TopBar icon="LD" name="Lorong Damai 12" sub={member.name} />
      <div className="screen">
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

        {state === 'none' && <NoBills member={member} />}
        {state === 'grace' && graceBill && (
          <GraceNudge member={member} billId={graceBill.id} />
        )}
        {state === 'locked' && lockedBill && (
          <JustLocked billId={lockedBill.id} />
        )}
        {state === 'calm' && <Calm member={member} />}

        <button className="btn-ghost" onClick={() => go({ name: 'hub' })}>
          Back to prototype hub
        </button>
      </div>
    </Frame>
  );
}

function NoBills({ member }: { member: { id: string } }) {
  return (
    <>
      <div className="card">
        <div className="eyebrow-pill">Nothing to split yet</div>
        <p className="sub">
          No bills have been added. Keep marking the days you're home — your
          count is ready the moment a bill arrives.
        </p>
      </div>
      <Calendar memberId={member.id} initial={{ year: 2026, month: 5 }} />
    </>
  );
}

function GraceNudge({ member, billId }: { member: { id: string }; billId: string }) {
  const { house, today } = useApp();
  const bill = house.bills.find((b) => b.id === billId)!;
  const m = house.members.find((x) => x.id === member.id)!;
  const myDays = daysInPeriod(m, bill);
  const left = bill.graceEndsOn ? daysUntil(bill.graceEndsOn, today) : 0;
  const meta = UTILITY_META[bill.utility];

  return (
    <>
      <div className="prompt-strip">
        <span className="pico">🔔</span>
        <div>
          Your days for the {meta.label.toLowerCase()} bill look light — only{' '}
          <b>{myDays} day{myDays === 1 ? '' : 's'}</b> recorded. There's still time
          to fix it before the split locks.
        </div>
      </div>

      <div className="card">
        <div className="row-between">
          <div>
            <div className="util-label" style={{ fontSize: 12 }}>
              {meta.label} · grace window
            </div>
            <div className="util-amount tnum" style={{ fontSize: 22 }}>
              {money(bill.amount)}
            </div>
            <div className="util-period">{formatPeriod(bill)}</div>
          </div>
          <span className="countdown">⏳ {left} day{left === 1 ? '' : 's'} left</span>
        </div>
      </div>

      <Calendar memberId={member.id} bill={bill} initial={{ year: 2026, month: 4 }} />
      <p className="muted-note" style={{ textAlign: 'center', marginTop: 4 }}>
        Tap the dotted days you were actually home for this period.
      </p>
    </>
  );
}

function JustLocked({ billId }: { billId: string }) {
  const { house } = useApp();
  const bill = house.bills.find((b) => b.id === billId)!;
  return (
    <>
      <div className="prompt-strip" style={{ background: 'var(--ok-bg)', color: 'var(--ok-ink)' }}>
        <span className="pico">✓</span>
        <div>This bill is locked. Here's the final split — your share is fixed.</div>
      </div>
      <WorkingCard bill={bill} members={house.members} rounding={NO_ROUNDING} />
    </>
  );
}

function Calm({ member }: { member: { id: string; name: string } }) {
  const { house } = useApp();
  const m = house.members.find((x) => x.id === member.id)!;
  return (
    <>
      <div className="card">
        <div className="eyebrow-pill">All caught up</div>
        <h1 className="title sm">Nothing needs you right now</h1>
        <p className="sub">
          No open bills, nothing to confirm. You can still record days as you go —
          they'll be ready for the next bill.
        </p>
        <div className="row-between" style={{ marginTop: 16 }}>
          <div className="person-left">
            <Avatar member={m} size="md" />
            <div className="person-name">{m.name}</div>
          </div>
          <span className="count-pill tnum">
            {m.presence.length} <span className="accent-num">days logged</span>
          </span>
        </div>
      </div>
      <Calendar memberId={member.id} initial={{ year: 2026, month: 5 }} />
    </>
  );
}
