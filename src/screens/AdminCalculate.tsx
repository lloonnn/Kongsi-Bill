import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, Frame, ScreenNav, TopBar } from '../ui';
import { BillSummaryCard, WorkingCard } from '../BillBreakdown';
import { calculate, remainderSentence } from '../calc';
import type { RoundingConfig } from '../types';

/**
 * Calculate & validate screen. Shows every share's literal working, a
 * reconciliation strip, and an off-by-default rounding toggle whose remainder
 * is always stated in plain-consequence language (never silently absorbed).
 */
export function AdminCalculate() {
  const { house, route, go, lockBill, setMemberAway } = useApp();
  const bill = house.bills.find((b) => b.id === route.billId);

  const [rounding, setRounding] = useState<RoundingConfig>({
    enabled: false,
    mode: 'down',
    increment: 0.05,
  });

  if (!bill) {
    return (
      <Frame>
        <TopBar icon="LD" name={house.name} sub="Calculate" admin />
        <div className="screen">
          <ScreenNav />
          <div className="card admin">
            <p className="sub">That bill no longer exists.</p>
          </div>
        </div>
      </Frame>
    );
  }

  const calc = calculate(bill, house.members, rounding);
  const blocked = calc.reconciliation.status === 'warn';

  // Members with 0 home days (away the whole period) — admin can confirm/exclude.
  const zeroDay = calc.shares.filter((s) => s.days === 0).map((s) => s.member);
  const excluded = house.members.filter((m) => bill.awayMemberIds?.includes(m.id));

  // Readiness: who has confirmed their days for this bill (participants only).
  const confirmedIds = new Set(bill.confirmedMemberIds ?? []);
  const participants = house.members.filter(
    (m) => m.active && !bill.awayMemberIds?.includes(m.id)
  );
  const pending = participants.filter((m) => !confirmedIds.has(m.id));
  const allConfirmed = pending.length === 0;

  const lock = () => {
    lockBill(bill.id);
    go({ name: 'admin-dashboard' });
  };

  const primaryLabel =
    bill.status !== 'open'
      ? 'Bill is locked'
      : blocked
      ? 'Resolve the flag above first'
      : allConfirmed
      ? 'Everyone confirmed — lock the split'
      : `Lock anyway — ${pending.length} not confirmed`;

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="Calculate & validate" admin />
      <div className="screen gap">
        <ScreenNav />

        <BillSummaryCard bill={bill} />
        <WorkingCard bill={bill} members={house.members} rounding={rounding} calc={calc} />

        {/* resolve "away the whole period" — exclude so the split can proceed */}
        {(zeroDay.length > 0 || excluded.length > 0) && bill.status !== 'locked' && (
          <div className="card admin">
            <div className="working-title">Away the whole period?</div>
            {zeroDay.map((m) => (
              <div className="member-pill" key={m.id}>
                <div className="left">
                  <div className="person-name">{m.name}</div>
                  <div className="meta">0 days home this period</div>
                </div>
                <button
                  className="copy-btn"
                  onClick={() => setMemberAway(bill.id, m.id, true)}
                >
                  Confirm away — exclude
                </button>
              </div>
            ))}
            {excluded.map((m) => (
              <div className="member-pill" key={m.id} style={{ opacity: 0.7 }}>
                <div className="left">
                  <div className="person-name">{m.name}</div>
                  <div className="meta">Excluded — pays nothing</div>
                </div>
                <button
                  className="remove-x"
                  style={{ color: 'var(--accent-dark)' }}
                  onClick={() => setMemberAway(bill.id, m.id, false)}
                >
                  Add back
                </button>
              </div>
            ))}
          </div>
        )}

        {/* days-confirmed readiness (open bills only) */}
        {bill.status === 'open' && participants.length > 0 && (
          <div className="card admin">
            <div className="row-between" style={{ marginBottom: 8 }}>
              <div className="working-title" style={{ marginBottom: 0 }}>
                Days confirmed
              </div>
              <span className={`status-pill ${allConfirmed ? 'locked' : 'open'}`}>
                {participants.length - pending.length} of {participants.length} ready
              </span>
            </div>
            {participants.map((m) => {
              const ok = confirmedIds.has(m.id);
              return (
                <div className="member-pill" key={m.id}>
                  <div className="left">
                    <Avatar member={m} size="sm" />
                    <div className="name">{m.name}</div>
                  </div>
                  <span
                    className="meta"
                    style={{ color: ok ? 'var(--ok-ink)' : 'var(--warn-ink)', fontWeight: 700 }}
                  >
                    {ok ? '✓ confirmed' : 'not yet'}
                  </span>
                </div>
              );
            })}
            {!allConfirmed && (
              <p className="muted-note" style={{ marginTop: 10 }}>
                {pending.map((m) => m.name).join(', ')} {pending.length === 1 ? 'hasn’t' : 'haven’t'} confirmed
                yet — they’re counted home for the whole period by default. You can
                still lock if you’re sure.
              </p>
            )}
          </div>
        )}

        {/* rounding toggle card */}
        <div className="card admin">
          <div className="toggle-row">
            <div>
              <div className="toggle-label">Round final amounts</div>
              <div className="toggle-sub">Off by default — full precision</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={rounding.enabled}
                onChange={(e) =>
                  setRounding((r) => ({ ...r, enabled: e.target.checked }))
                }
              />
              <span className="switch-track" />
            </label>
          </div>

          {rounding.enabled && (
            <>
              <div className="round-options">
                <div
                  className={`round-option ${rounding.mode === 'down' ? 'selected' : ''}`}
                  onClick={() => setRounding((r) => ({ ...r, mode: 'down' }))}
                >
                  <div className="ro-label">Round down</div>
                  <div className="ro-sub">to nearest $0.05</div>
                </div>
                <div
                  className={`round-option ${rounding.mode === 'up' ? 'selected' : ''}`}
                  onClick={() => setRounding((r) => ({ ...r, mode: 'up' }))}
                >
                  <div className="ro-label">Round up</div>
                  <div className="ro-sub">to nearest $0.05</div>
                </div>
              </div>
              <div className="remainder-note">{remainderSentence(calc.remainder)}</div>
            </>
          )}
        </div>

        <button className="btn-primary" disabled={blocked || bill.status === 'locked'} onClick={lock}>
          {primaryLabel}
        </button>
      </div>
    </Frame>
  );
}
