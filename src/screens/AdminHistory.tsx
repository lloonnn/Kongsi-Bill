import { useApp } from '../store';
import { ExtrapolatedTag, Frame, ScreenNav, TopBar } from '../ui';
import { CombinedBillCard } from '../CombinedBillCard';
import { groupBillsByMonth } from '../calc';

/**
 * History as combined bills — one per billing month. Each combined bill shows
 * the single amount paid to the landlord and how it's composed (each utility ×
 * each person). Tap a utility to open its working. Extrapolated screen.
 */
export function AdminHistory() {
  const { house, go } = useApp();
  const groups = groupBillsByMonth(house.bills);

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="Combined bills" admin />
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
            key={g.key}
            group={g}
            admin
            onOpenBill={(billId) => go({ name: 'admin-bill-detail', billId })}
          />
        ))}
      </div>
    </Frame>
  );
}
