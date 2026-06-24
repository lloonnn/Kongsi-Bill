import { useApp } from '../store';
import { Frame, TopBar } from '../ui';

interface HubItem {
  emoji: string;
  title: string;
  sub: string;
  go: () => void;
  admin?: boolean;
}

/**
 * Prototype launcher. Not a product screen — it's the entry point that lets a
 * reviewer jump into any flow using the one mock house as the running example.
 */
export function Hub() {
  const { go } = useApp();

  const member: HubItem[] = [
    {
      emoji: '👋',
      title: 'Member first-tap join',
      sub: 'Welcome → recognize-or-name → calendar',
      go: () => go({ name: 'member-join' }),
    },
    {
      emoji: '🗓️',
      title: 'Returning member landing',
      sub: 'State-aware: no bills, grace nudge, or just-locked split',
      go: () => go({ name: 'member-landing' }),
    },
  ];

  const admin: HubItem[] = [
    {
      emoji: '🏠',
      title: 'Create a house (admin setup)',
      sub: 'Codes → save-codes (weighted) → housemates → share link',
      go: () => go({ name: 'admin-setup' }),
      admin: true,
    },
    {
      emoji: '📊',
      title: 'Manage the house (admin)',
      sub: 'Add bill, calculate & validate, confirm, history, export',
      go: () => go({ name: 'admin-dashboard' }),
      admin: true,
    },
  ];

  return (
    <Frame>
      <TopBar icon="LD" name="Kongsi Bill" sub="Click-through prototype" />
      <div className="screen">
        <div className="card">
          <div className="eyebrow-pill">Prototype hub</div>
          <h1 className="title">
            Day-weighted bill <span className="accent">splitting</span>
          </h1>
          <p className="sub">
            Running example: <b>Lorong Damai 12</b> — Alice, Bob &amp; Carol, with a
            locked January electricity bill, one in its grace window, and one draft.
            Pick a flow to walk through.
          </p>
        </div>

        <div className="hub-section-label">Member experience</div>
        {member.map((it) => (
          <HubButton key={it.title} item={it} />
        ))}

        <div className="hub-section-label">Admin territory</div>
        {admin.map((it) => (
          <HubButton key={it.title} item={it} />
        ))}

        <p className="muted-note" style={{ marginTop: 18, textAlign: 'center' }}>
          Mock data only — nothing persists across reloads.
        </p>
      </div>
    </Frame>
  );
}

function HubButton({ item }: { item: HubItem }) {
  return (
    <button className={`hub-btn ${item.admin ? 'admin' : ''}`} onClick={item.go}>
      <span className="hub-emoji">{item.emoji}</span>
      <span>
        <span className="hb-title">{item.title}</span>
        <span className="hb-sub" style={{ display: 'block' }}>
          {item.sub}
        </span>
      </span>
    </button>
  );
}
