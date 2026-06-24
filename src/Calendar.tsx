import { useState } from 'react';
import type { Bill } from './types';
import { useApp } from './store';
import { isInPeriod, UTILITY_META } from './calc';

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
 * - Days inside `bill`'s period show a dot, but every day stays tappable —
 *   recording outside any bill is allowed, it just counts toward nothing.
 * - Day count updates live as days are toggled.
 */
export function Calendar({
  memberId,
  bill,
  initial,
}: {
  memberId: string;
  bill?: Bill;
  initial: { year: number; month: number };
}) {
  const { house, togglePresence } = useApp();
  const [view, setView] = useState(initial);

  const member = house.members.find((m) => m.id === memberId);
  if (!member) return null;
  const marked = new Set(member.presence);

  const firstDow = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

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

  const monthCount = [...marked].filter((k) => {
    const [y, m] = k.split('-').map(Number);
    return y === view.year && m - 1 === view.month;
  }).length;

  const dotLabel = bill
    ? `dot = inside ${UTILITY_META[bill.utility].label.toLowerCase()} bill`
    : 'tap a day to toggle presence';

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
          const on = marked.has(key);
          const inPeriod = bill ? isInPeriod(key, bill) : false;
          return (
            <button
              key={key}
              className={`cal-day ${on ? 'on' : ''} ${inPeriod ? 'in-period' : ''}`.trim()}
              onClick={() => togglePresence(memberId, key)}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="count-pill-row">
        <span className="count-pill-label">{dotLabel}</span>
        <span className="count-pill">
          {monthCount} <span className="accent-num">day{monthCount === 1 ? '' : 's'}</span>
        </span>
      </div>
    </div>
  );
}
