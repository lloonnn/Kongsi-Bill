import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, Frame, ScreenNav, TopBar } from '../ui';
import { Calendar } from '../Calendar';
import type { DateRange } from '../types';

/**
 * The admin is a housemate too — but there is no special "admin member" record
 * anymore. They simply pick which housemate is them, then mark their own
 * presence with the same calendar everyone uses.
 */
export function AdminMyDays() {
  const { house, back, currentMemberId, setCurrentMember, setPresence, confirmDays } = useApp();
  const members = house.members.filter((m) => m.active);
  const me = members.find((m) => m.member_id === currentMemberId) ?? null;
  const [draft, setDraft] = useState<DateRange[] | null>(null);

  const bills = house.bills;

  const save = async () => {
    if (me) {
      await setPresence(me.member_id, draft ?? me.presence);
      await confirmDays(me.member_id);
    }
    back();
  };

  return (
    <Frame>
      <TopBar icon="LD" name={house.display_name} sub="My days" admin />
      <div className="screen">
        <ScreenNav />

        {members.length === 0 ? (
          <div className="card admin">
            <div className="working-title">No housemates yet</div>
            <p className="muted-note">
              Add yourself as a housemate first — you split the bills too.
            </p>
          </div>
        ) : !me ? (
          <div className="card admin">
            <div className="working-title">Which one is you?</div>
            <p className="muted-note" style={{ marginBottom: 12 }}>
              Pick your own name so we mark the right person’s days.
            </p>
            {members.map((m) => (
              <div
                className="member-pill"
                key={m.member_id}
                onClick={() => setCurrentMember(m.member_id)}
                style={{ cursor: 'pointer' }}
              >
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
              {me.name} (you), mark any days you were away
            </div>
            <Calendar
              memberId={me.member_id}
              bills={bills}
              initial={{ year: 2026, month: 5 }}
              onChange={setDraft}
            />
            {bills.length > 0 && (
              <p className="muted-note" style={{ textAlign: 'center', marginTop: 4 }}>
                You’re counted home by default — tap only the days you were away. Each
                bill counts only the dates in its own period.
              </p>
            )}
            <button className="btn-primary" onClick={save}>
              Save &amp; mark my days correct
            </button>
          </>
        )}
      </div>
    </Frame>
  );
}
