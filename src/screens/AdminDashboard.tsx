import { useApp } from '../store';
import { Avatar, Frame, ScreenNav, StatusPill, TopBar } from '../ui';
import { billIcon, billLabel, formatPeriod, money } from '../calc';
import type { Bill } from '../types';

/** Admin house home — bill list + quick actions into every admin tool. */
export function AdminDashboard() {
  const { house, go, adminCode } = useApp();
  const activeMembers = house.members.filter((m) => m.active);

  // Admin-only area: a housemate (member code only) has no admin key, so every
  // admin action here would fail. Send them to their own home page instead.
  if (!adminCode) {
    return (
      <Frame>
        <TopBar icon="LD" name={house.display_name} sub="Admin only" admin />
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

  return (
    <Frame>
      <TopBar icon="LD" name={house.display_name} sub="House overview" admin />
      <div className="screen gap">
        <ScreenNav />

        {/* Step 1 — the bills for this cycle come first. */}
        <div className="card admin">
          <div className="row-between" style={{ marginBottom: 4 }}>
            <div className="working-title" style={{ marginBottom: 0 }}>
              1 · Bills
            </div>
            <button className="copy-btn" onClick={() => go({ name: 'admin-add-bill' })}>
              + Add bill
            </button>
          </div>
          {house.bills.length === 0 && (
            <p className="muted-note" style={{ marginBottom: 8 }}>
              Start here — add this cycle’s bills (electricity, water…).
            </p>
          )}

          {house.bills.map((b) => {
            return (
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
            );
          })}

          {house.bills.length > 0 && (
            <button
              className="btn-primary"
              style={{ marginTop: 14 }}
              onClick={() => go({ name: 'admin-combined' })}
            >
              ✅ Finalize &amp; announce the bills
            </button>
          )}
        </div>

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
