import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, ExtrapolatedTag, Frame, ScreenNav, TopBar } from '../ui';
import { Calendar } from '../Calendar';
import { ShareCodes } from '../ShareCodes';
import { WorkingCard } from '../BillBreakdown';
import { billIcon, billLabel, formatPeriod, money, NO_ROUNDING } from '../calc';

// Four landing states the prototype can simulate via the dev toggle.
type LandingState = 'none' | 'open' | 'locked' | 'calm';

const STATE_LABELS: Record<LandingState, string> = {
  none: 'No bills',
  open: 'Open bill',
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
  const [state, setState] = useState<LandingState>('open');

  const member = house.members.find((m) => m.id === currentMemberId) ?? house.members[0];
  const openBill = house.bills.find((b) => b.status === 'open');
  const lockedBill = house.bills.find((b) => b.status === 'locked');

  return (
    <Frame>
      <TopBar icon="LD" name="Lorong Damai 12" sub={member.name} />
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
        {state === 'open' && openBill && <OpenBill member={member} />}
        {state === 'locked' && lockedBill && (
          <JustLocked billId={lockedBill.id} />
        )}
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

function OpenBill({ member }: { member: { id: string } }) {
  const { house, confirmDays } = useApp();
  const openBills = house.bills.filter((b) => b.status === 'open');
  const confirmed =
    openBills.length > 0 &&
    openBills.every((b) => b.confirmedMemberIds?.includes(member.id));

  return (
    <>
      <div className="prompt-strip">
        <span className="pico">🗓️</span>
        <div>
          {openBills.length === 1 ? 'There’s an open bill.' : `There are ${openBills.length} open bills.`}{' '}
          You’re counted home by default — just mark any days you were away. No
          rush, they lock once everyone’s done.
        </div>
      </div>

      {openBills.map((bill) => (
        <div className="card" key={bill.id}>
          <div className="row-between">
            <div>
              <div className="util-label" style={{ fontSize: 12 }}>
                {billLabel(bill)} · open
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

      <Calendar memberId={member.id} bills={openBills} initial={{ year: 2026, month: 4 }} />
      <p className="muted-note" style={{ textAlign: 'center', marginTop: 4 }}>
        Orange = counted home. Tap a day to mark yourself away — each bill counts
        only the dates in its own period.
      </p>

      {confirmed ? (
        <div className="recon-strip ok" style={{ marginTop: 14 }}>
          <span>✓</span>
          <div>
            Your days are confirmed. Edit a day above any time before it locks —
            you’ll just need to confirm again.
          </div>
        </div>
      ) : (
        <button className="btn-primary" onClick={() => confirmDays(member.id)}>
          These look right — confirm my days
        </button>
      )}
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
    <div className="card">
      <div className="eyebrow-pill">All caught up</div>
      <h1 className="title sm">Nothing needs you right now</h1>
      <p className="sub">
        No open bills, nothing to confirm. When the next bill arrives you’ll be
        counted home by default — you’ll only need to note any days you were away.
      </p>
      <div className="row-between" style={{ marginTop: 16 }}>
        <div className="person-left">
          <Avatar member={m} size="md" />
          <div className="person-name">{m.name}</div>
        </div>
      </div>
    </div>
  );
}
