import type { ReactNode } from 'react';
import type { Member, BillStatus } from './types';
import { useApp } from './store';

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

function toneClass(tone: Member['tone']): string {
  return tone === 'alt2' ? 'alt2' : tone === 'alt3' ? 'alt3' : '';
}

export function Avatar({
  member,
  size = 'md',
}: {
  member: Pick<Member, 'name' | 'tone'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? '' : size; // '' = the default 38px
  return (
    <div className={`avatar ${sizeClass} ${toneClass(member.tone)}`.trim()}>
      {initials(member.name)}
    </div>
  );
}

export function ExtrapolatedTag() {
  return (
    <span className="extrapolated-tag" title="Not yet design-reviewed">
      extrapolated
    </span>
  );
}

const STATUS_TEXT: Record<BillStatus, string> = {
  open: 'Open',
  locked: 'Locked',
};

export function StatusPill({ status }: { status: BillStatus }) {
  return <span className={`status-pill ${status}`}>{STATUS_TEXT[status]}</span>;
}

export function TopBar({
  icon,
  name,
  sub,
  admin = false,
}: {
  icon: string;
  name: string;
  sub: string;
  admin?: boolean;
}) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className={`houseicon ${admin ? 'admin' : ''}`}>{icon}</div>
        <div>
          <div className="name">{name}</div>
          <div className="sub">{sub}</div>
        </div>
      </div>
      {admin && <div className="admin-badge">Admin</div>}
    </div>
  );
}

export function Frame({ children }: { children: ReactNode }) {
  return <div className="frame">{children}</div>;
}

export function ProgressRow({
  total,
  done,
  admin = false,
}: {
  total: number;
  done: number;
  admin?: boolean;
}) {
  return (
    <div className={`progress-row ${admin ? 'admin' : ''}`}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`seg ${i < done ? 'done' : ''}`} />
      ))}
    </div>
  );
}

export function BackLink({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button className="back-link" onClick={onClick}>
      ‹ {label}
    </button>
  );
}

/**
 * Top-of-screen navigation: "Back" goes to the previous page (or a custom
 * step-back via `onBack`); "Home" always returns to the first page.
 */
export function ScreenNav({ onBack, backLabel = 'Back' }: { onBack?: () => void; backLabel?: string }) {
  const { back, home, canGoBack } = useApp();
  return (
    <div className="screen-nav">
      <button
        className="back-link"
        onClick={onBack ?? back}
        disabled={!onBack && !canGoBack}
      >
        ‹ {backLabel}
      </button>
      <button className="back-link home" onClick={home}>
        Home ⌂
      </button>
    </div>
  );
}
