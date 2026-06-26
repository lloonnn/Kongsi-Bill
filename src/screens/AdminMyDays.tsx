import { useApp } from '../store';
import { Frame, ScreenNav, TopBar } from '../ui';
import { Calendar } from '../Calendar';

/**
 * The admin is a housemate too, so they mark their own presence here — the
 * same tappable calendar everyone uses, for their own member record.
 */
export function AdminMyDays() {
  const { house, back, confirmDays } = useApp();
  const me = house.members.find((m) => m.id === house.adminMemberId) ?? house.members[0];
  const openBills = house.bills.filter((b) => b.status === 'open');

  const save = () => {
    confirmDays(me.id);
    back();
  };

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="My days" admin />
      <div className="screen">
        <ScreenNav />
        <div className="greeting-line">
          {me.name} (you), mark any days you were away
        </div>
        <Calendar memberId={me.id} bills={openBills} initial={{ year: 2026, month: 5 }} />
        {openBills.length > 0 && (
          <p className="muted-note" style={{ textAlign: 'center', marginTop: 4 }}>
            You’re counted home by default — tap only the days you were away. Each
            bill counts only the dates in its own period.
          </p>
        )}
        <button className="btn-primary" onClick={save}>
          Save &amp; confirm my days
        </button>
      </div>
    </Frame>
  );
}
