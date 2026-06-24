import { useApp } from '../store';
import { BackLink, ExtrapolatedTag, Frame, StatusPill, TopBar } from '../ui';
import { formatPeriod, money, UTILITY_META } from '../calc';

/** Flat list of past bills; each opens its per-person breakdown. Extrapolated. */
export function AdminHistory() {
  const { house, go, back } = useApp();
  const bills = [...house.bills].sort((a, b) =>
    a.periodStart < b.periodStart ? 1 : -1
  );

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="History" admin />
      <div className="screen">
        <BackLink onClick={back} />
        <div className="card admin">
          <ExtrapolatedTag />
          <div className="working-title">All bills</div>
          <p className="muted-note" style={{ marginBottom: 12 }}>
            Every bill the house has recorded. Tap one to see its period and the
            per-person breakdown.
          </p>

          {bills.map((b) => {
            const meta = UTILITY_META[b.utility];
            return (
              <button
                key={b.id}
                className="list-row"
                onClick={() => go({ name: 'admin-bill-detail', billId: b.id })}
              >
                <div className="person-left">
                  <div className="bill-icon" style={{ width: 38, height: 38, fontSize: 17 }}>
                    {meta.icon}
                  </div>
                  <div>
                    <div className="lr-title">{meta.label}</div>
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
        </div>
      </div>
    </Frame>
  );
}
