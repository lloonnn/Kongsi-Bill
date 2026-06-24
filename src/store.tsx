import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AvatarTone, Bill, House, Member } from './types';
import { initialHouse, TODAY } from './mockData';

// ---------------------------------------------------------------------------
// Routing — a tiny stack-based router (no react-router; this is a prototype).
// ---------------------------------------------------------------------------

export type RouteName =
  | 'hub'
  | 'member-join'
  | 'member-landing'
  | 'admin-setup'
  | 'admin-dashboard'
  | 'admin-add-bill'
  | 'admin-calculate'
  | 'admin-history'
  | 'admin-bill-detail'
  | 'admin-export'
  | 'admin-changelog'
  | 'admin-members'
  | 'admin-regenerate';

export interface Route {
  name: RouteName;
  billId?: string;
}

const TONES: AvatarTone[] = ['accent', 'alt2', 'alt3'];

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function nowStamp(): string {
  // Deterministic-ish readable stamp anchored to the prototype's "today".
  return new Date(TODAY + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface AppContextValue {
  house: House;
  today: string;
  route: Route;
  currentMemberId: string;
  // navigation
  go: (route: Route) => void;
  back: () => void;
  canGoBack: boolean;
  // identity
  setCurrentMember: (id: string) => void;
  // mutations
  togglePresence: (memberId: string, key: string) => void;
  addMember: (name: string) => Member;
  softRemoveMember: (memberId: string) => void;
  restoreMember: (memberId: string) => void;
  addBill: (bill: Omit<Bill, 'id' | 'status'>) => string;
  confirmBill: (billId: string) => void;
  lockBill: (billId: string) => void;
  overrideLockedBill: (billId: string, newAmount: number) => void;
  regenerateMemberCode: () => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [house, setHouse] = useState<House>(initialHouse);
  const [stack, setStack] = useState<Route[]>([{ name: 'hub' }]);
  const [currentMemberId, setCurrentMemberId] = useState<string>('m-bob');

  const route = stack[stack.length - 1];

  const value = useMemo<AppContextValue>(() => {
    const go = (r: Route) => setStack((s) => [...s, r]);
    const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

    const log = (h: House, text: string): House => ({
      ...h,
      changeLog: [
        { id: 'log-' + Date.now(), at: nowStamp() + ' · now', who: 'Admin', text },
        ...h.changeLog,
      ],
    });

    const togglePresence = (memberId: string, key: string) =>
      setHouse((h) => ({
        ...h,
        members: h.members.map((m) => {
          if (m.id !== memberId) return m;
          const has = m.presence.includes(key);
          return {
            ...m,
            presence: has
              ? m.presence.filter((k) => k !== key)
              : [...m.presence, key],
          };
        }),
      }));

    const addMember = (name: string): Member => {
      const member: Member = {
        id: 'm-' + Date.now(),
        name,
        tone: TONES[house.members.length % TONES.length],
        active: true,
        presence: [],
      };
      setHouse((h) => ({ ...h, members: [...h.members, member] }));
      return member;
    };

    const softRemoveMember = (memberId: string) =>
      setHouse((h) => {
        const m = h.members.find((x) => x.id === memberId);
        const next = {
          ...h,
          members: h.members.map((x) =>
            x.id === memberId ? { ...x, active: false } : x
          ),
        };
        return log(next, `Soft-removed ${m?.name ?? 'a housemate'} — kept in past bills, no longer recording.`);
      });

    const restoreMember = (memberId: string) =>
      setHouse((h) => {
        const m = h.members.find((x) => x.id === memberId);
        const next = {
          ...h,
          members: h.members.map((x) =>
            x.id === memberId ? { ...x, active: true } : x
          ),
        };
        return log(next, `Restored ${m?.name ?? 'a housemate'} to active recording.`);
      });

    const addBill = (bill: Omit<Bill, 'id' | 'status'>): string => {
      const id = 'bill-' + Date.now();
      setHouse((h) => ({
        ...h,
        bills: [{ ...bill, id, status: 'draft' }, ...h.bills],
      }));
      return id;
    };

    const confirmBill = (billId: string) =>
      setHouse((h) => {
        const next = {
          ...h,
          bills: h.bills.map((b) =>
            b.id === billId
              ? { ...b, status: 'grace' as const, graceEndsOn: addDaysIso(TODAY, 7) }
              : b
          ),
        };
        return log(next, `Confirmed a bill — 7-day grace window opened (closes ${addDaysIso(TODAY, 7)}).`);
      });

    const lockBill = (billId: string) =>
      setHouse((h) => {
        const next = {
          ...h,
          bills: h.bills.map((b) =>
            b.id === billId
              ? { ...b, status: 'locked' as const, lockedOn: nowStamp() }
              : b
          ),
        };
        return log(next, `Locked a bill — final split is now fixed.`);
      });

    const overrideLockedBill = (billId: string, newAmount: number) =>
      setHouse((h) => {
        const b = h.bills.find((x) => x.id === billId);
        const next = {
          ...h,
          bills: h.bills.map((x) =>
            x.id === billId ? { ...x, amount: newAmount } : x
          ),
        };
        return log(
          next,
          `Admin override after lock — amount changed from $${b?.amount.toFixed(2)} to $${newAmount.toFixed(2)}.`
        );
      });

    const regenerateMemberCode = (): string => {
      const fresh =
        'NEW-' +
        Math.floor(1000 + Math.random() * 9000).toString();
      setHouse((h) => log({ ...h, memberCode: fresh }, `Regenerated member code — old code "${house.memberCode}" no longer works.`));
      return fresh;
    };

    return {
      house,
      today: TODAY,
      route,
      currentMemberId,
      go,
      back,
      canGoBack: stack.length > 1,
      setCurrentMember: setCurrentMemberId,
      togglePresence,
      addMember,
      softRemoveMember,
      restoreMember,
      addBill,
      confirmBill,
      lockBill,
      overrideLockedBill,
      regenerateMemberCode,
    };
  }, [house, stack, route, currentMemberId]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
