import { useApp } from '../store';
import { Frame, ScreenNav, TopBar } from '../ui';
import { CombinedBillCard } from '../CombinedBillCard';
import { groupBillsByMonth } from '../calc';

/**
 * Member-facing history: the same combined bills, read-only. Every housemate
 * sees the combined amount per cycle, how it's composed, and each person's
 * home-day count and share.
 */
export function MemberHistory() {
  const { house } = useApp();
  const groups = groupBillsByMonth(house.bills);

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="Combined bills" />
      <div className="screen gap">
        <ScreenNav />

        <div className="card">
          <div className="working-title">Combined bills</div>
          <p className="muted-note">
            What the house pays the landlord each cycle. Tap a combined bill to
            see how it’s made up and what everyone owes. Open bills can still
            change as people mark their away days.
          </p>
        </div>

        {groups.map((g) => (
          <CombinedBillCard key={g.key} group={g} />
        ))}
      </div>
    </Frame>
  );
}
