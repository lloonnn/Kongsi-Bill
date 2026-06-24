import { useState } from 'react';
import { useApp } from '../store';
import { Avatar, BackLink, ExtrapolatedTag, Frame, TopBar } from '../ui';

/** Soft-remove / restore / add housemates. Extrapolated admin utility. */
export function AdminMembers() {
  const { house, back, addMember, softRemoveMember, restoreMember } = useApp();
  const [name, setName] = useState('');

  const add = () => {
    const v = name.trim();
    if (!v) return;
    addMember(v);
    setName('');
  };

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="Housemates" admin />
      <div className="screen">
        <BackLink onClick={back} />
        <div className="card admin">
          <ExtrapolatedTag />
          <div className="working-title">Housemates</div>
          <p className="muted-note" style={{ marginBottom: 12 }}>
            Soft-removing keeps someone in past bills but stops them recording new
            days. You can restore them anytime.
          </p>

          {house.members.map((m) => (
            <div className="member-pill" key={m.id} style={{ opacity: m.active ? 1 : 0.55 }}>
              <div className="left">
                <Avatar member={m} size="sm" />
                <div>
                  <div className="name">{m.name}</div>
                  <div className="meta">
                    {m.active ? `${m.presence.length} days logged` : 'Soft-removed'}
                  </div>
                </div>
              </div>
              {m.active ? (
                <button
                  className="remove-x"
                  onClick={() => softRemoveMember(m.id)}
                >
                  Remove
                </button>
              ) : (
                <button
                  className="remove-x"
                  style={{ color: 'var(--accent-dark)' }}
                  onClick={() => restoreMember(m.id)}
                >
                  Restore
                </button>
              )}
            </div>
          ))}

          <div className="add-member-row">
            <input
              type="text"
              className="field"
              placeholder="Add a housemate's name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button onClick={add} aria-label="Add housemate">
              +
            </button>
          </div>
        </div>
      </div>
    </Frame>
  );
}
