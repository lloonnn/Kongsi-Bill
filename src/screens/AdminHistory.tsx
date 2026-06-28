import { useApp } from '../store';
import { ExtrapolatedTag, Frame, ScreenNav, TopBar } from '../ui';
import { CombinedBillCard } from '../CombinedBillCard';
import { groupBillsByCycle } from '../calc';

/**
 * History as combined bills — one per billing cycle (migration 0005). Each cycle
 * shows the single amount paid to the landlord and how it's composed (each
 * utility × each person). Tap a utility to open its working. Extrapolated screen.
 */
export function AdminHistory() {
  const { house, go } = useApp();
  // Only cycles that actually have bills appear in history.
  const groups = groupBillsByCycle(house.bills, house.cycles).filter((g) => g.bills.length > 0);

  return (
    <Frame>
      <TopBar icon="LD" name={house.display_name} sub="Combined bills" admin />
      <div className="screen gap">
        <ScreenNav />

        <div className="card admin">
          <ExtrapolatedTag />
          <div className="working-title">Combined bills</div>
          <p className="muted-note">
            One combined amount goes to the landlord each cycle. Tap a combined
            bill to see how it’s made up and what each person owes in total.
          </p>
        </div>

        {groups.map((g) => (
          <CombinedBillCard
            key={g.cycle.cycle_id}
            group={g}
            admin
            onOpenBill={(billId) => go({ name: 'admin-bill-detail', billId })}
          />
        ))}
      </div>
    </Frame>
  );
}
