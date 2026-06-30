import type { ReactNode } from 'react';
import type { AvatarTone, Member, BillStatus } from './types';
import { useApp } from './store';

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

const TONES: AvatarTone[] = ['accent', 'alt2', 'alt3'];

/**
 * Avatar tone is a frontend-only presentational detail derived from the member
 * id (never stored or sent). A stable string hash keeps each member's colour
 * consistent across renders.
 */
function toneFor(seed: string): AvatarTone {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TONES[Math.abs(h) % TONES.length];
}

function toneClass(tone: AvatarTone): string {
  return tone === 'alt2' ? 'alt2' : tone === 'alt3' ? 'alt3' : '';
}

export function Avatar({
  member,
  size = 'md',
}: {
  member: Pick<Member, 'name' | 'member_id'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? '' : size; // '' = the default 38px
  return (
    <div className={`avatar ${sizeClass} ${toneClass(toneFor(member.member_id))}`.trim()}>
      {initials(member.name)}
    </div>
  );
}

const STATUS_TEXT: Record<BillStatus, string> = {
  draft: 'Open',
  confirmed: 'Confirmed',
  paid: 'Done',
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
