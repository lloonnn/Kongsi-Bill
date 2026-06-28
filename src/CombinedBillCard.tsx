import { useState } from 'react';
import { BillOverview } from './BillOverview';
import { money, type CycleGroup } from './calc';

/**
 * One billing cycle (migration 0005), collapsed by default. Tapping the header
 * reveals the composition table — each utility × each person, with the combined
 * per-person totals for that cycle.
 */
export function CombinedBillCard({
  group,
  admin = false,
  onOpenBill,
}: {
  group: CycleGroup;
  admin?: boolean;
  onOpenBill?: (billId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`card ${admin ? 'admin' : ''}`}>
      <button className="combined-header" onClick={() => setOpen((o) => !o)}>
        <div className="bill-card">
          <div className="util-label">{group.cycle.display_name}</div>
          <div className="util-amount tnum" style={{ fontSize: 24 }}>
            {money(group.total)}
          </div>
          <div className="util-period">
            combined · {group.bills.length} item{group.bills.length === 1 ? '' : 's'}
          </div>
        </div>
        <span className={`combined-chevron ${open ? 'open' : ''}`}>›</span>
      </button>
      {open && <BillOverview bills={group.bills} onOpenBill={onOpenBill} />}
    </div>
  );
}
