import { useApp } from '../store';
import { Frame, ScreenNav, TopBar } from '../ui';
import { CombinedBillCard } from '../CombinedBillCard';
import { groupBillsByCycle } from '../calc';

/**
 * Member-facing history: the same combined bills, read-only. Every housemate
 * sees the combined amount per cycle (migration 0005), how it's composed, and
 * each person's home-day count and share.
 */
export function MemberHistory() {
  const { house } = useApp();
  // Only cycles that actually have bills appear in history.
  const groups = groupBillsByCycle(house.bills, house.cycles).filter((g) => g.bills.length > 0);

  return (
    <Frame>
      <TopBar icon="LD" name={house.display_name} sub="Combined bills" />
      <div className="screen gap">
        <ScreenNav />

        <div className="card">
          <div className="working-title">Combined bills</div>
          <p className="muted-note">
            What the house pays the landlord each billing period. Tap a combined bill to
            see how it’s made up and what everyone owes. Open bills can still
            change as people mark their away days.
          </p>
        </div>

        {groups.map((g) => (
          <CombinedBillCard key={g.cycle.cycle_id} group={g} />
        ))}
      </div>
    </Frame>
  );
}
