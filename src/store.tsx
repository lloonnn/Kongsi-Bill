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
  | 'member-history'
  | 'admin-setup'
  | 'admin-dashboard'
  | 'admin-my-days'
  | 'admin-edit-days'
  | 'admin-add-bill'
  | 'admin-calculate'
  | 'admin-history'
  | 'admin-bill-detail'
  | 'admin-export'
  | 'admin-members'
  | 'admin-invite';

export interface Route {
  name: RouteName;
  billId?: string;
  memberId?: string;
}

const TONES: AvatarTone[] = ['accent', 'alt2', 'alt3'];

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
  home: () => void;
  canGoBack: boolean;
  // identity
  setCurrentMember: (id: string) => void;
  // mutations
  toggleAway: (memberId: string, key: string) => void;
  confirmDays: (memberId: string) => void;
  addMember: (name: string) => Member;
  softRemoveMember: (memberId: string) => void;
  restoreMember: (memberId: string) => void;
  addBill: (bill: Omit<Bill, 'id' | 'status'>) => string;
  lockBill: (billId: string) => void;
  reopenBill: (billId: string) => void;
  setMemberAway: (billId: string, memberId: string, away: boolean) => void;
  overrideLockedBill: (billId: string, newAmount: number) => void;
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
    const home = () => setStack([{ name: 'hub' }]);

    const toggleAway = (memberId: string, key: string) =>
      setHouse((h) => ({
        ...h,
        members: h.members.map((m) => {
          if (m.id !== memberId) return m;
          const has = m.awayDays.includes(key);
          return {
            ...m,
            awayDays: has
              ? m.awayDays.filter((k) => k !== key)
              : [...m.awayDays, key],
          };
        }),
        // changing days un-confirms this member on every open bill
        bills: h.bills.map((b) =>
          b.status === 'open' && b.confirmedMemberIds?.includes(memberId)
            ? { ...b, confirmedMemberIds: b.confirmedMemberIds.filter((id) => id !== memberId) }
            : b
        ),
      }));

    const confirmDays = (memberId: string) =>
      setHouse((h) => ({
        ...h,
        bills: h.bills.map((b) =>
          b.status === 'open'
            ? { ...b, confirmedMemberIds: [...new Set([...(b.confirmedMemberIds ?? []), memberId])] }
            : b
        ),
      }));

    const addMember = (name: string): Member => {
      const member: Member = {
        id: 'm-' + Date.now(),
        name,
        tone: TONES[house.members.length % TONES.length],
        active: true,
        awayDays: [],
      };
      setHouse((h) => ({ ...h, members: [...h.members, member] }));
      return member;
    };

    const softRemoveMember = (memberId: string) =>
      setHouse((h) => ({
        ...h,
        members: h.members.map((x) =>
          x.id === memberId ? { ...x, active: false } : x
        ),
      }));

    const restoreMember = (memberId: string) =>
      setHouse((h) => ({
        ...h,
        members: h.members.map((x) =>
          x.id === memberId ? { ...x, active: true } : x
        ),
      }));

    const addBill = (bill: Omit<Bill, 'id' | 'status'>): string => {
      const id = 'bill-' + Date.now();
      setHouse((h) => ({
        ...h,
        bills: [{ ...bill, id, status: 'open' }, ...h.bills],
      }));
      return id;
    };

    const lockBill = (billId: string) =>
      setHouse((h) => ({
        ...h,
        bills: h.bills.map((b) =>
          b.id === billId
            ? { ...b, status: 'locked' as const, lockedOn: nowStamp() }
            : b
        ),
      }));

    const reopenBill = (billId: string) =>
      setHouse((h) => ({
        ...h,
        bills: h.bills.map((b) =>
          b.id === billId
            ? { ...b, status: 'open' as const, lockedOn: undefined, confirmedMemberIds: [] }
            : b
        ),
      }));

    const setMemberAway = (billId: string, memberId: string, away: boolean) =>
      setHouse((h) => ({
        ...h,
        bills: h.bills.map((b) => {
          if (b.id !== billId) return b;
          const current = new Set(b.awayMemberIds ?? []);
          if (away) current.add(memberId);
          else current.delete(memberId);
          return { ...b, awayMemberIds: [...current] };
        }),
      }));

    const overrideLockedBill = (billId: string, newAmount: number) =>
      setHouse((h) => ({
        ...h,
        bills: h.bills.map((x) =>
          x.id === billId ? { ...x, amount: newAmount } : x
        ),
      }));

    return {
      house,
      today: TODAY,
      route,
      currentMemberId,
      go,
      back,
      home,
      canGoBack: stack.length > 1,
      setCurrentMember: setCurrentMemberId,
      toggleAway,
      confirmDays,
      addMember,
      softRemoveMember,
      restoreMember,
      addBill,
      lockBill,
      reopenBill,
      setMemberAway,
      overrideLockedBill,
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
