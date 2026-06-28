import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bill, DateRange } from './types';
import { useApp } from './store';
import { isInPeriod, presentDaysFromRanges, rangesFromPresentDays } from './calc';

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
 * All YYYY-MM-DD keys inside a bill period (inclusive). Parsed and formatted in
 * UTC so the keys match the calendar cells exactly regardless of the viewer's
 * timezone (local + toISOString would shift the keys a day in UTC+ zones).
 */
function periodKeys(bill: Bill): string[] {
  const out: string[] = [];
  const d = new Date(bill.period_start + 'T00:00:00Z');
  const last = new Date(bill.period_end + 'T00:00:00Z');
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Tappable presence calendar with month navigation.
 *
 * The data model is PRESENT days (matching the API): a member's stored presence
 * ranges expand into the set of days they were home. Following the blueprint's
 * default-to-present rule, a member with NO stored presence starts with every
 * in-period day selected as present — so they only tap to *remove* the days
 * they were away. Edits stay local; the parent persists them via `onChange`
 * (clean { start, end } ranges) and its own Save button (store.setPresence).
 */
export function Calendar({
  memberId,
  bills = [],
  initial,
  onChange,
}: {
  memberId: string;
  bills?: Bill[];
  initial: { year: number; month: number };
  onChange?: (ranges: DateRange[]) => void;
}) {
  const { house } = useApp();
  const [view, setView] = useState(initial);

  const member = house.members.find((m) => m.member_id === memberId);

  const seed = (): Set<string> => {
    if (!member) return new Set();
    if (member.presence.length === 0) {
      // Default to present: pre-select every EDITABLE day. Days inside a
      // non-draft (locked) bill are skipped — they can't be tapped, and
      // pre-selecting them would re-send them on save and trip the Worker's
      // paid-period 409.
      const s = new Set<string>();
      for (const b of bills) {
        if (b.status !== 'draft') continue;
        for (const k of periodKeys(b)) s.add(k);
      }
      return s;
    }
    return presentDaysFromRanges(member.presence);
  };

  const [present, setPresent] = useState<Set<string>>(seed);

  // The full set of EDITABLE day-keys (in a draft bill's period; locked bills
  // contribute none). Used to tell an untouched default-present selection from a
  // real one: if every editable day is still present, nothing was deselected.
  const editableDays = useMemo(() => {
    const s = new Set<string>();
    for (const b of bills) {
      if (b.status !== 'draft') continue;
      for (const k of periodKeys(b)) s.add(k);
    }
    return s;
  }, [bills]);

  // Reseed when the member being edited changes (admin editing several people).
  useEffect(() => {
    setPresent(seed());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  // Report the current ranges to the parent whenever the selection changes,
  // including the initial (default-present) seed so a Save-without-tapping
  // still persists a clean record.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    // If the present set still equals the full set of editable days, the member
    // hasn't deselected anything → report [] so we never store an explicit
    // whole-period range (which would wrongly exclude future bills' periods).
    const untouched =
      present.size === editableDays.size &&
      [...present].every((k) => editableDays.has(k));
    onChangeRef.current?.(untouched ? [] : rangesFromPresentDays(present));
  }, [present, editableDays]);

  if (!member) return null;

  const firstDow = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const dayInPeriod = (key: string) => bills.some((b) => isInPeriod(key, b));
  // A day inside a PAID bill's period is locked (final) — its split is settled,
  // so it can't be edited without the admin reopening that bill.
  const dayLocked = (key: string) =>
    bills.some((b) => b.status !== 'draft' && isInPeriod(key, b));
  const dayEditable = (key: string) => dayInPeriod(key) && !dayLocked(key);
  const hasLocked = bills.some((b) => b.status !== 'draft');

  const toggle = (key: string) =>
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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

  // Home (present) days this member counts in the visible month.
  let homeThisMonth = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = fmtKey(view.year, view.month, d);
    if (dayInPeriod(key) && present.has(key)) homeThisMonth++;
  }

  const dotLabel = bills.length
    ? 'tap the days you were away'
    : 'no bill in range, please add a bill';

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
          const locked = dayLocked(key);
          const editable = dayEditable(key);
          const isPresent = present.has(key);
          const cls = !inPeriod
            ? 'out'
            : locked
            ? `locked ${isPresent ? '' : 'away'}`.trim()
            : isPresent
            ? 'present'
            : 'away';
          return (
            <button
              key={key}
              className={`cal-day ${cls}`}
              disabled={!editable}
              title={locked ? 'This bill is paid — days are final' : undefined}
              onClick={() => editable && toggle(key)}
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

      {hasLocked && (
        <p className="muted-note" style={{ marginTop: 10 }}>
          🔒 Green-locked days belong to a <b>finished</b> bill — they’re final.
          Ask the admin to reopen that bill if a date is wrong.
        </p>
      )}
    </div>
  );
}
