import { useApp, type RouteName } from '../store';
import { Frame, TopBar } from '../ui';

interface Entry {
  icon: string;
  title: string;
  hint: string;
  route: RouteName;
}

/**
 * App entry. Reads like the real product: you say which person you are first,
 * then see only that person's screens — so a housemate is never shown the
 * bill-payer's "set up the house" as if it were their task.
 */
export function Hub() {
  const { go } = useApp();

  const payer: Entry[] = [
    { icon: '🏠', title: 'Create a new house', hint: 'First time setting up', route: 'admin-setup' },
    { icon: '📋', title: 'Open my house', hint: 'Bills, splits, history', route: 'admin-dashboard' },
  ];

  const housemate: Entry[] = [
    { icon: '🔗', title: 'Join a house', hint: 'Opened an invite link', route: 'member-join' },
    { icon: '🏡', title: 'Open my home page', hint: 'Coming back', route: 'member-landing' },
  ];

  const Row = ({ e, admin }: { e: Entry; admin?: boolean }) => (
    <button
      className={`hub-btn ${admin ? 'admin' : ''}`}
      onClick={() => go({ name: e.route })}
    >
      <span className="hub-num">{e.icon}</span>
      <span style={{ flex: 1 }}>
        <span className="hb-title">{e.title}</span>
        <span className="hb-sub">{e.hint}</span>
      </span>
      <span className="hb-go">›</span>
    </button>
  );

  return (
    <Frame>
      <TopBar icon="LD" name="Kongsi Bill" sub="Welcome" />
      <div className="screen">
        <div className="card">
          <h1 className="title">
            Split bills by <span className="accent">days at home</span>
          </h1>
          <p className="sub">Which one are you?</p>
        </div>

        <div className="hub-section-label">I’m the bill-payer</div>
        {payer.map((e) => (
          <Row key={e.route} e={e} admin />
        ))}

        <div className="hub-section-label">I’m a housemate</div>
        {housemate.map((e) => (
          <Row key={e.route} e={e} />
        ))}
      </div>
    </Frame>
  );
}
