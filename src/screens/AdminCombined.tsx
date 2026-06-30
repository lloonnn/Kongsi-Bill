import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, Frame, ScreenNav, TopBar } from '../ui';
import { billLabel, calculateCombined, money, remainderSentence } from '../calc';
import type { RoundingConfig } from '../types';

/**
 * Finalize the bills — the admin's "wrap up this cycle" screen and the ONLY
 * place fees are calculated. It always combines every OPEN (draft) bill into one
 * total per person (no per-bill marking paid, nothing "some can some cannot").
 *
 * Two stages only — matching the real flow:
 *   Open   → housemates mark days; admin sees readiness + the combined fees,
 *            shares them, collects money.
 *   Settled→ admin closes the case (marks all paid); dates lock, moves to history.
 * There is no separate "lock" step: closing the case IS the lock.
 */
export function AdminCombined() {
  const { house, route, go, adminCode, finalizeCycle, busy } = useApp();
  const [rounding, setRounding] = useState<RoundingConfig>({
    enabled: false,
    mode: 'down',
    increment: 0.05,
  });
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reminderCopied, setReminderCopied] = useState(false);

  if (!adminCode) {
    return (
      <Frame>
        <TopBar name={house.display_name} sub="Admin only" admin />
        <div className="screen">
          <ScreenNav />
          <div className="card">
            <p className="sub">This needs the admin key.</p>
          </div>
        </div>
      </Frame>
    );
  }

  // Scoped to ONE cycle (migration 0005): Calculate never combines across cycles.
  const cycleId = route.cycleId ?? '';
  const cycle = house.cycles.find((c) => c.cycle_id === cycleId);
  const members = house.members.filter((m) => m.active);
  const openBills = house.bills.filter((b) => b.cycle_id === cycleId && b.status === 'draft');
  const hasPaid = house.bills.some((b) => b.cycle_id === cycleId && b.status === 'paid');
  const calc = calculateCombined(openBills, house.members, rounding);

  // Calculate is always scoped to a specific cycle (reached from the dashboard).
  if (!cycle) {
    return (
      <Frame>
        <TopBar name={house.display_name} sub="Calculate" admin />
        <div className="screen gap">
          <ScreenNav />
          <div className="card admin">
            <p className="sub">Pick a billing period to calculate from the house overview.</p>
            <button className="btn-primary" onClick={() => go({ name: 'admin-dashboard' })}>
              Back to house
            </button>
          </div>
        </div>
      </Frame>
    );
  }

  const ready = members.filter((m) => m.days_confirmed);
  const pending = members.filter((m) => !m.days_confirmed);

  const copyAmounts = async () => {
    const text = [
      `${house.display_name} — bills`,
      ...openBills.map((b) => `• ${billLabel(b)} ${money(b.amount)}`),
      `Total: ${money(calc.grandTotal)}`,
      '',
      ...calc.shares.map((s) => `${s.member.name}: ${money(s.amount)}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  };

  // One finishing action: announce the amounts (copy to clipboard) AND finalize
  // THIS cycle — its bills settle (splits freeze) and it files into history. A
  // different cycle's bills are never touched. No separate "pay then close".
  const announce = async () => {
    await copyAmounts();
    await finalizeCycle(cycleId);
  };

  // If everyone's marked their days, announcing is one tap. If some haven't, we
  // pause to explain what happens to them (they pay a full default share) and
  // offer to send a reminder — so it's never a confusing accidental click.
  const onDone = () => {
    if (pending.length === 0) announce();
    else setConfirming(true);
  };

  const copyReminder = async () => {
    const text =
      `Reminder for ${house.display_name}: please mark your days in Kongsi Bill ` +
      `before I finalize the bills. If you don't, you're counted home the whole ` +
      `period and pay a full share. Join code: ${house.member_code}`;
    try {
      await navigator.clipboard.writeText(text);
      setReminderCopied(true);
      setTimeout(() => setReminderCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  };

  // No open bills: either nothing added yet, or everything's been settled.
  if (openBills.length === 0) {
    return (
      <Frame>
        <TopBar name={house.display_name} sub={`Calculate · ${cycle.display_name}`} admin />
        <div className="screen gap">
          <ScreenNav />
          <div className="card admin">
            {hasPaid ? (
              <>
                <div className="recon-strip ok">
                  <span>🎉</span>
                  <div>Announced &amp; done — this billing period is closed and filed in history.</div>
                </div>
                <button className="btn-primary" onClick={() => go({ name: 'admin-history' })}>
                  View in history
                </button>
              </>
            ) : (
              <>
                <p className="sub">No bills to finalize yet — add one first.</p>
                <button className="btn-primary" onClick={() => go({ name: 'admin-add-bill' })}>
                  Add a bill
                </button>
              </>
            )}
          </div>
          <button className="btn-secondary" onClick={() => go({ name: 'admin-dashboard' })}>
            Back to house
          </button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <TopBar name={house.display_name} sub="Finalize the bills" admin />
      <div className="screen gap">
        <ScreenNav />

        {/* 1 — readiness: who has marked their days correct */}
        <div className="card admin">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <div className="working-title" style={{ marginBottom: 0 }}>
              Days marked correct
            </div>
            <span className={`status-pill ${pending.length === 0 ? 'confirmed' : 'draft'}`}>
              {ready.length} of {members.length} done
            </span>
          </div>
          {members.map((m) => (
            <div className="member-pill" key={m.member_id}>
              <div className="left">
                <Avatar member={m} size="sm" />
                <div className="name">{m.name}</div>
              </div>
              <span
                className="meta"
                style={{ color: m.days_confirmed ? 'var(--ok-ink)' : 'var(--warn-ink)', fontWeight: 700 }}
              >
                {m.days_confirmed ? '✓ marked correct' : 'not yet'}
              </span>
            </div>
          ))}
          {pending.length > 0 && (
            <p className="muted-note" style={{ marginTop: 10 }}>
              {pending.map((m) => m.name).join(', ')} {pending.length === 1 ? "hasn't" : "haven't"}{' '}
              marked their days — until they do they’re counted <b>home the whole
              period</b>, so they pay a <b>full share</b> (the most they could owe).
              You can wait and remind them, fill them in via “Mark days for a
              housemate”, or just announce — they’ll pay the default.
            </p>
          )}
        </div>

        {/* 2 — the combined fees (this is the calculation) */}
        <div className="card admin">
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div className="working-title" style={{ marginBottom: 0 }}>
              What each person owes
            </div>
            <div className="util-amount tnum" style={{ fontSize: 20 }}>
              {money(calc.grandTotal)}
            </div>
          </div>

          {/* the bills that make up the combine */}
          <p className="muted-note" style={{ marginBottom: 10 }}>
            Combining {openBills.length} bill{openBills.length === 1 ? '' : 's'}:{' '}
            {openBills.map((b) => `${billLabel(b)} ${money(b.amount)}`).join('  ·  ')}
          </p>

          {calc.shares.map((s) => (
            <div className="person-row" key={s.member.member_id} style={{ alignItems: 'flex-start' }}>
              <div className="person-left">
                <Avatar member={s.member} size="md" />
                <div>
                  <div className="person-name">{s.member.name}</div>
                  <div className="person-working tnum">
                    {s.components.map((c) => `${billLabel(c.bill)} ${money(c.exact)}`).join('  ·  ')}
                  </div>
                </div>
              </div>
              <div className="person-amount tnum">{money(s.amount)}</div>
            </div>
          ))}

          {/* combined rounding */}
          <div className="toggle-row" style={{ marginTop: 10 }}>
            <div>
              <div className="toggle-label">Round each person’s combined total</div>
              <div className="toggle-sub">Rounds the sum, not each bill</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={rounding.enabled}
                onChange={(e) => setRounding((r) => ({ ...r, enabled: e.target.checked }))}
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

          <div className={`recon-strip ${calc.reconciliation.status}`} style={{ marginTop: 10 }}>
            <span>{calc.reconciliation.status === 'ok' ? '✓' : '⚠'}</span>
            <div>
              <div>{calc.reconciliation.message}</div>
              {calc.reconciliation.detail && (
                <div className="recon-detail">{calc.reconciliation.detail}</div>
              )}
            </div>
          </div>
        </div>

        {/* 3 — one finishing action: announce + done (with a pause if not everyone is ready) */}
        {!confirming ? (
          <>
            <p className="muted-note" style={{ textAlign: 'center' }}>
              {pending.length === 0
                ? 'Everyone’s marked their days. Announce the amounts to finish — copies them for your chat, locks days, files to history.'
                : `${pending.length} of ${members.length} haven’t marked their days yet.`}
            </p>
            <button className="btn-primary" onClick={onDone} disabled={busy}>
              {copied ? '✓ Announced & done' : '✅ Done — announce the amounts'}
            </button>
          </>
        ) : (
          <div className="card admin">
            <div className="prompt-strip">
              <span className="pico">⏳</span>
              <div>
                <b>{pending.map((m) => m.name).join(', ')}</b>{' '}
                {pending.length === 1 ? "hasn't" : "haven't"} marked their days. If you
                announce now, they’re charged a <b>full share</b> (counted home all
                period). Remind them first, or announce anyway.
              </div>
            </div>
            <button className="btn-secondary" onClick={copyReminder}>
              {reminderCopied ? '✓ Reminder copied — send it' : '📋 Copy a reminder to send them'}
            </button>
            <button className="btn-primary" onClick={announce} disabled={busy}>
              Announce anyway
            </button>
            <button className="btn-ghost" onClick={() => setConfirming(false)}>
              Wait for them
            </button>
          </div>
        )}

        <button className="btn-secondary" onClick={() => go({ name: 'admin-dashboard' })}>
          Back to house
        </button>
      </div>
    </Frame>
  );
}
