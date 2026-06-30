import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, Frame, ScreenNav, StatusPill, TopBar } from '../ui';
import { billIcon, billLabel, formatPeriod, groupBillsByCycle, money } from '../calc';
import { isCycleActive } from '../cyclePlacement';
import type { Bill } from '../types';

/** Admin house home — bill list + quick actions into every admin tool. */
export function AdminDashboard() {
  const { house, go, adminCode, deleteCycle, busy } = useApp();
  const activeMembers = house.members.filter((m) => m.active);
  // Which cycle is mid-delete-confirm (inline, no window.confirm) — at most one.
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  // Admin-only area: a housemate (member code only) has no admin key, so every
  // admin action here would fail. Send them to their own home page instead.
  if (!adminCode) {
    return (
      <Frame>
        <TopBar name={house.display_name} sub="Admin only" admin />
        <div className="screen">
          <ScreenNav />
          <div className="card">
            <div className="eyebrow-pill">🔑 Admin only</div>
            <h1 className="title sm">This is the bill-payer’s area</h1>
            <p className="sub">
              Managing bills and housemates needs the admin key, which only the
              bill-payer holds. If that's you, enter your admin code to take over
              here. Otherwise you can still mark your days and see the splits from
              your home page.
            </p>
            <button className="btn-primary" onClick={() => go({ name: 'admin-manage' })}>
              Enter admin code
            </button>
            <button className="btn-secondary" onClick={() => go({ name: 'member-landing' })}>
              Go to my home page
            </button>
            <button className="btn-secondary" onClick={() => go({ name: 'hub' })}>
              Back to start
            </button>
          </div>
        </div>
      </Frame>
    );
  }

  // One Bill screen handles everything (split, edit, mark paid, delete).
  const openBill = (b: Bill) => go({ name: 'admin-bill-detail', billId: b.bill_id });

  // Bills are grouped under their explicit cycle (migration 0005); Calculate acts
  // on one cycle at a time — never across cycles. The main screen shows only the
  // ACTIVE cycles (open, or reopened — see cyclePlacement); finalized cycles live
  // in History so settled history never floods the working view.
  const groups = groupBillsByCycle(house.bills, house.cycles).filter((g) =>
    isCycleActive(g.cycle, g.bills)
  );

  return (
    <Frame>
      <TopBar name={house.display_name} sub="House overview" admin />
      <div className="screen gap">
        <ScreenNav />

        {/* Step 1 — bills, grouped by billing cycle. */}
        <div className="card admin">
          <div className="row-between" style={{ marginBottom: 4 }}>
            <div className="working-title" style={{ marginBottom: 0 }}>
              1 · Active billing periods
            </div>
            <button className="copy-btn" onClick={() => go({ name: 'admin-add-cycle' })}>
              + New billing period
            </button>
          </div>
          {groups.length === 0 && (
            <p className="muted-note" style={{ marginBottom: 8 }}>
              {house.cycles.length === 0
                ? 'Start here — create a billing period (e.g. “June 2026”), then add its bills (electricity, water…).'
                : 'No active billing periods right now. Create a new one above, or find settled billing periods in History.'}
            </p>
          )}
        </div>

        {groups.map((g) => {
          const hasDrafts = g.bills.some((b) => b.status === 'draft');
          return (
            <div className="card admin" key={g.cycle.cycle_id}>
              <div className="row-between" style={{ marginBottom: 8 }}>
                <div>
                  <div className="working-title" style={{ marginBottom: 2 }}>
                    {g.cycle.display_name}
                  </div>
                  <div className="lr-sub">
                    {g.bills.length} bill{g.bills.length === 1 ? '' : 's'} ·{' '}
                    <span className="tnum">{money(g.total)}</span>
                  </div>
                </div>
                {/* Everything on this screen is active; a reopened cycle (status
                    still 'finalized' but with a draft bill) correctly reads "open". */}
                <span className="status-pill draft">open</span>
              </div>

              {g.bills.length === 0 && (
                <p className="muted-note" style={{ marginBottom: 8 }}>
                  No bills in this billing period yet.
                </p>
              )}

              {g.bills.map((b) => (
                <button key={b.bill_id} className="list-row" onClick={() => openBill(b)}>
                  <div className="person-left">
                    <div className="bill-icon" style={{ width: 38, height: 38, fontSize: 17 }}>
                      {billIcon(b)}
                    </div>
                    <div>
                      <div className="lr-title">{billLabel(b)}</div>
                      <div className="lr-sub">{formatPeriod(b)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="lr-amount tnum">{money(b.amount)}</div>
                    <div style={{ marginTop: 6 }}>
                      <StatusPill status={b.status} />
                    </div>
                  </div>
                </button>
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  className="btn-secondary"
                  style={{ marginTop: 0 }}
                  onClick={() => go({ name: 'admin-add-bill', cycleId: g.cycle.cycle_id })}
                >
                  + Add bill
                </button>
                {hasDrafts && (
                  <button
                    className="btn-primary"
                    style={{ marginTop: 0 }}
                    onClick={() => go({ name: 'admin-combined', cycleId: g.cycle.cycle_id })}
                  >
                    🧮 Calculate
                  </button>
                )}
              </div>

              {/* Delete the whole cycle — cascades to its bills. Inline confirm
                  (no window.confirm) since it's destructive and irreversible. */}
              {confirmingDelete === g.cycle.cycle_id ? (
                <div className="prompt-strip" style={{ marginTop: 12 }}>
                  <span className="pico">🗑️</span>
                  <div style={{ flex: 1 }}>
                    Delete <b>{g.cycle.display_name}</b> and its {g.bills.length} bill
                    {g.bills.length === 1 ? '' : 's'}? This can’t be undone.
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        className="btn-primary"
                        style={{ marginTop: 0 }}
                        disabled={busy}
                        onClick={async () => {
                          await deleteCycle(g.cycle.cycle_id);
                          setConfirmingDelete(null);
                        }}
                      >
                        {busy ? 'Deleting…' : 'Delete billing period'}
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ marginTop: 0 }}
                        onClick={() => setConfirmingDelete(null)}
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  className="btn-ghost"
                  style={{ marginTop: 8 }}
                  onClick={() => setConfirmingDelete(g.cycle.cycle_id)}
                >
                  🗑️ Delete billing period
                </button>
              )}
            </div>
          );
        })}

        {/* Step 2 — then mark your own days. */}
        <div className="card admin">
          <div className="row-between">
            <div>
              <div className="working-title" style={{ marginBottom: 6 }}>
                2 · Your days &amp; housemates
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {activeMembers.map((m) => (
                  <Avatar key={m.member_id} member={m} size="md" />
                ))}
              </div>
            </div>
            <button className="btn-secondary" style={{ width: 'auto', marginTop: 0 }} onClick={() => go({ name: 'admin-members' })}>
              Manage
            </button>
          </div>
          <button
            className="btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => go({ name: 'admin-my-days' })}
          >
            🗓️ Mark my own days
          </button>
        </div>

        <div className="card admin">
          <div className="working-title">House tools</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <button className="list-row" onClick={() => go({ name: 'admin-edit-days' })}>
              <span className="lr-title">🗓️ Mark days for a housemate</span>
              <span className="lr-sub">›</span>
            </button>
            <button className="list-row" onClick={() => go({ name: 'admin-history' })}>
              <span className="lr-title">📜 View history</span>
              <span className="lr-sub">›</span>
            </button>
            <button className="list-row" onClick={() => go({ name: 'admin-export' })}>
              <span className="lr-title">📤 Export</span>
              <span className="lr-sub">›</span>
            </button>
            <button className="list-row" onClick={() => go({ name: 'admin-invite' })}>
              <span className="lr-title">🔗 Invite &amp; share codes</span>
              <span className="lr-sub">›</span>
            </button>
          </div>
        </div>
      </div>
    </Frame>
  );
}
