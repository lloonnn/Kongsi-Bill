import type { Bill, Member, RoundingConfig } from './types';
import {
  billIcon,
  billLabel,
  calculate,
  formatPeriod,
  money,
  NO_ROUNDING,
  type Calculation,
} from './calc';
import { Avatar } from './ui';

/** Bill summary header card (utility, amount, period). Admin-context card. */
export function BillSummaryCard({ bill }: { bill: Bill }) {
  return (
    <div className="card admin bill-card">
      <div className="util-row">
        <div>
          <div className="util-label">{billLabel(bill)}</div>
          <div className="util-amount tnum">{money(bill.amount)}</div>
          <div className="util-period">{formatPeriod(bill)}</div>
        </div>
        <div className="bill-icon">{billIcon(bill)}</div>
      </div>
    </div>
  );
}

/**
 * Per-person working card. Every share shows the literal working
 * (e.g. "31/67 days × $100.00") — a locked transparency requirement.
 * Includes the reconciliation strip (✓ reconciled OR an actionable flag).
 */
export function WorkingCard({
  bill,
  members,
  rounding = NO_ROUNDING,
  calc,
}: {
  bill: Bill;
  members: Member[];
  rounding?: RoundingConfig;
  calc?: Calculation;
}) {
  const c = calc ?? calculate(bill, members, rounding);
  return (
    <div className="card admin">
      <div className="working-title">Per-person working</div>
      {c.shares.map((s) => (
        <div className="person-row" key={s.member.id}>
          <div className="person-left">
            <Avatar member={s.member} size="md" />
            <div>
              <div className="person-name">{s.member.name}</div>
              <div className="person-working tnum">{s.working}</div>
            </div>
          </div>
          <div className="person-amount tnum">{money(s.amount)}</div>
        </div>
      ))}

      <div className={`recon-strip ${c.reconciliation.status}`}>
        <span>{c.reconciliation.status === 'ok' ? '✓' : '⚠'}</span>
        <div>
          <div>{c.reconciliation.message}</div>
          {c.reconciliation.detail && (
            <div className="recon-detail">{c.reconciliation.detail}</div>
          )}
        </div>
      </div>
    </div>
  );
}
