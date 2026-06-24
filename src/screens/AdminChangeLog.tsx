import { useApp } from '../store';
import { BackLink, ExtrapolatedTag, Frame, TopBar } from '../ui';

/** Visible change log — every override, confirm, lock, code change. Extrapolated. */
export function AdminChangeLog() {
  const { house, back } = useApp();

  return (
    <Frame>
      <TopBar icon="LD" name={house.name} sub="Change log" admin />
      <div className="screen">
        <BackLink onClick={back} />
        <div className="card admin">
          <ExtrapolatedTag />
          <div className="working-title">Change log</div>
          <p className="muted-note" style={{ marginBottom: 12 }}>
            A running record of admin actions. Overrides after lock land here so
            the whole house can see what changed and when.
          </p>

          {house.changeLog.map((e) => (
            <div className="log-entry" key={e.id}>
              <div className="log-dot" />
              <div>
                <div className="log-text">{e.text}</div>
                <div className="log-meta">
                  {e.who} · {e.at}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}
