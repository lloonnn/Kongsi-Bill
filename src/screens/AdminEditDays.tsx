import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, Frame, ScreenNav, TopBar } from '../ui';
import { Calendar } from '../Calendar';

/**
 * Admin helps fill in a housemate's days — pick a person, then edit their
 * calendar (same present-by-default rules). Useful when someone can't or
 * won't mark their own away days.
 */
export function AdminEditDays() {
  const { house } = useApp();
  const [memberId, setMemberId] = useState<string | null>(null);

  const members = house.members.filter((m) => m.active);
  const openBills = house.bills.filter((b) => b.status === 'open');
  const selected = members.find((m) => m.id === memberId);

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="Mark days for someone" admin />
      <div className="screen">
        <ScreenNav onBack={selected ? () => setMemberId(null) : undefined} />

        {!selected ? (
          <div className="card admin">
            <div className="working-title">Whose days?</div>
            <p className="muted-note" style={{ marginBottom: 12 }}>
              Pick a housemate to fill in their away days on their behalf.
            </p>
            {members.map((m) => (
              <div className="member-pill" key={m.id} onClick={() => setMemberId(m.id)} style={{ cursor: 'pointer' }}>
                <div className="left">
                  <Avatar member={m} size="sm" />
                  <div className="name">{m.name}</div>
                </div>
                <span className="lr-sub">›</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="greeting-line">
              Editing {selected.name}’s days — counted home by default, tap the
              days they were away
            </div>
            <Calendar memberId={selected.id} bills={openBills} initial={{ year: 2026, month: 5 }} />
            <button className="btn-primary" onClick={() => setMemberId(null)}>
              Save {selected.name}’s days
            </button>
          </>
        )}
      </div>
    </Frame>
  );
}
