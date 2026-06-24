import { useApp } from '../store';
import { Avatar, BackLink, Frame, StatusPill, TopBar } from '../ui';
import { daysUntil, formatPeriod, money, UTILITY_META } from '../calc';
import type { Bill } from '../types';

/** Admin house home — bill list + quick actions into every admin tool. */
export function AdminDashboard() {
  const { house, go, back, today } = useApp();
  const activeMembers = house.members.filter((m) => m.active);

  const openBill = (b: Bill) =>
    go(
      b.status === 'locked'
        ? { name: 'admin-bill-detail', billId: b.id }
        : { name: 'admin-calculate', billId: b.id }
    );

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="House overview" admin />
      <div className="screen gap">
        <BackLink onClick={back} label="Hub" />

        <div className="card admin">
          <div className="row-between">
            <div>
              <div className="working-title" style={{ marginBottom: 6 }}>
                Housemates
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {activeMembers.map((m) => (
                  <Avatar key={m.id} member={m} size="md" />
                ))}
              </div>
            </div>
            <button className="btn-secondary" style={{ width: 'auto', marginTop: 0 }} onClick={() => go({ name: 'admin-members' })}>
              Manage
            </button>
          </div>
        </div>

        <div className="card admin">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <div className="working-title" style={{ marginBottom: 0 }}>
              Bills
            </div>
            <button className="copy-btn" onClick={() => go({ name: 'admin-add-bill' })}>
              + Add bill
            </button>
          </div>

          {house.bills.map((b) => {
            const meta = UTILITY_META[b.utility];
            const left =
              b.status === 'grace' && b.graceEndsOn
                ? daysUntil(b.graceEndsOn, today)
                : null;
            return (
              <button key={b.id} className="list-row" onClick={() => openBill(b)}>
                <div className="person-left">
                  <div className="bill-icon" style={{ width: 38, height: 38, fontSize: 17 }}>
                    {meta.icon}
                  </div>
                  <div>
                    <div className="lr-title">{meta.label}</div>
                    <div className="lr-sub">{formatPeriod(b)}</div>
                    {left !== null && (
                      <div className="lr-sub" style={{ color: 'var(--warn-ink)' }}>
                        ⏳ {left} day{left === 1 ? '' : 's'} of grace left
                      </div>
                    )}
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
        </div>

        <div className="card admin">
          <div className="working-title">House tools</div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <button className="list-row" onClick={() => go({ name: 'admin-history' })}>
              <span className="lr-title">📜 View history</span>
              <span className="lr-sub">›</span>
            </button>
            <button className="list-row" onClick={() => go({ name: 'admin-export' })}>
              <span className="lr-title">📤 Export</span>
              <span className="lr-sub">›</span>
            </button>
            <button className="list-row" onClick={() => go({ name: 'admin-changelog' })}>
              <span className="lr-title">🪵 Change log</span>
              <span className="lr-sub">›</span>
            </button>
            <button className="list-row" onClick={() => go({ name: 'admin-regenerate' })}>
              <span className="lr-title">🔑 Regenerate leaked code</span>
              <span className="lr-sub">›</span>
            </button>
          </div>
        </div>
      </div>
    </Frame>
  );
}
