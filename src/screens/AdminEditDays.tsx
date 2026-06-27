import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, Frame, ScreenNav, TopBar } from '../ui';
import { Calendar } from '../Calendar';
import type { DateRange } from '../types';

/**
 * Admin helps fill in a housemate's days — pick a person, then edit their
 * calendar (same present-by-default rules). Useful when someone can't or
 * won't mark their own away days.
 */
export function AdminEditDays() {
  const { house, setPresence, confirmDays, error } = useApp();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DateRange[] | null>(null);

  const members = house.members.filter((m) => m.active);
  const bills = house.bills;
  const selected = members.find((m) => m.member_id === memberId);

  const save = async () => {
    if (selected) {
      await setPresence(selected.member_id, draft ?? selected.presence);
      await confirmDays(selected.member_id); // admin entered them, so mark correct
    }
    setMemberId(null);
    setDraft(null);
  };

  return (
    <Frame>
      <TopBar icon="LD" name={house.display_name} sub="Mark days for someone" admin />
      <div className="screen">
        <ScreenNav onBack={selected ? () => setMemberId(null) : undefined} />

        {!selected ? (
          <div className="card admin">
            <div className="working-title">Whose days?</div>
            <p className="muted-note" style={{ marginBottom: 12 }}>
              Pick a housemate to fill in their away days on their behalf.
            </p>
            {members.map((m) => (
              <div className="member-pill" key={m.member_id} onClick={() => setMemberId(m.member_id)} style={{ cursor: 'pointer' }}>
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
            <Calendar
              memberId={selected.member_id}
              bills={bills}
              initial={{ year: 2026, month: 5 }}
              onChange={setDraft}
            />
            <button className="btn-primary" onClick={save}>
              Save {selected.name}’s days
            </button>
            {error && (
              <p className="muted-note" style={{ color: 'var(--warn-ink)', marginTop: 8 }}>
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </Frame>
  );
}
