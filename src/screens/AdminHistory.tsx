import { useApp } from '../store';
import { ExtrapolatedTag, Frame, ScreenNav, TopBar } from '../ui';
import { CombinedBillCard } from '../CombinedBillCard';
import { groupBillsByCycle } from '../calc';
import { isCycleActive } from '../cyclePlacement';

/**
 * History as combined bills — the FINALIZED cycles (migration 0005). Active cycles
 * (open, or reopened) live on the main bills screen; once a cycle is finalized and
 * settled it moves here. Reopening a bill makes its cycle active again, so it
 * leaves History until it's re-finalized. Each cycle shows the single amount paid
 * to the landlord and how it's composed. Tap a utility to open its working.
 */
export function AdminHistory() {
  const { house, go } = useApp();
  // Finalized/settled cycles only — the complement of the main screen's active
  // cycles. (Active cycles with no bills are excluded anyway.)
  const groups = groupBillsByCycle(house.bills, house.cycles).filter(
    (g) => g.bills.length > 0 && !isCycleActive(g.cycle, g.bills)
  );

  return (
    <Frame>
      <TopBar icon="LD" name={house.display_name} sub="Combined bills" admin />
      <div className="screen gap">
        <ScreenNav />

        <div className="card admin">
          <ExtrapolatedTag />
          <div className="working-title">Finalized cycles</div>
          <p className="muted-note">
            Settled cycles, filed once you finalize them. One combined amount goes
            to the landlord each cycle — tap a cycle to see how it’s made up and
            what each person owes. Open a bill to reopen it if something’s wrong;
            that moves the whole cycle back to the main screen until you re-finalize.
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="card admin">
            <p className="muted-note">
              No finalized cycles yet. Once you Calculate a cycle, it settles and
              files here.
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <CombinedBillCard
              key={g.cycle.cycle_id}
              group={g}
              admin
              onOpenBill={(billId) => go({ name: 'admin-bill-detail', billId })}
            />
          ))
        )}
      </div>
    </Frame>
  );
}
