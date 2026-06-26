import { useState } from 'react';
import type { Bill } from './types';
import { useApp } from './store';
import { isInPeriod } from './calc';

function fmtKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function monthLabel(y: number, m: number): string {
  return new Date(y, m, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Tappable presence calendar with month navigation.
 *
 * - Month nav (‹ ›) lets a period cross month boundaries.
 * - Days inside ANY of `bills`' periods show a dot (the union), but every day
 *   stays tappable — recording outside a bill is allowed, it counts toward
 *   nothing. Each bill's own calculation only uses days within its own period.
 * - Day count updates live as days are toggled.
 */
export function Calendar({
  memberId,
  bills = [],
  initial,
}: {
  memberId: string;
  bills?: Bill[];
  initial: { year: number; month: number };
}) {
  const { house, toggleAway } = useApp();
  const [view, setView] = useState(initial);

  const member = house.members.find((m) => m.id === memberId);
  if (!member) return null;
  const awaySet = new Set(member.awayDays);

  const firstDow = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const dayInPeriod = (key: string) => bills.some((b) => isInPeriod(key, b));

  const nav = (delta: number) =>
    setView((v) => {
      let m = v.month + delta;
      let y = v.year;
      if (m > 11) {
        m = 0;
        y++;
      }
      if (m < 0) {
        m = 11;
        y--;
      }
      return { year: y, month: m };
    });

  // Home days this member counts in the visible month (in-period & not away).
  let homeThisMonth = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = fmtKey(view.year, view.month, d);
    if (dayInPeriod(key) && !awaySet.has(key)) homeThisMonth++;
  }

  const dotLabel = bills.length
    ? 'tap the days you were away'
    : 'no open bill — nothing to mark yet';

  return (
    <div className="card">
      <div className="cal-card-header">
        <button className="cal-nav-btn" onClick={() => nav(-1)} aria-label="Previous month">
          ‹
        </button>
        <span className="cal-month-label">{monthLabel(view.year, view.month)}</span>
        <button className="cal-nav-btn" onClick={() => nav(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="cal-grid">
        {DOW.map((d, i) => (
          <div key={i} className="cal-dow">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDow }, (_, i) => (
          <div key={'pad' + i} className="cal-day muted" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = fmtKey(view.year, view.month, day);
          const inPeriod = dayInPeriod(key);
          const away = awaySet.has(key);
          const cls = !inPeriod ? 'out' : away ? 'away' : 'present';
          return (
            <button
              key={key}
              className={`cal-day ${cls}`}
              disabled={!inPeriod}
              onClick={() => inPeriod && toggleAway(memberId, key)}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="count-pill-row">
        <span className="count-pill-label">{dotLabel}</span>
        <span className="count-pill">
          home {homeThisMonth}{' '}
          <span className="accent-num">day{homeThisMonth === 1 ? '' : 's'}</span>
        </span>
      </div>
    </div>
  );
}
