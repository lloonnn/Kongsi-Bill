import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Bill, BillStatus, DateRange, HouseState, Member } from './types';
import { initialAdminCode, initialHouse, TODAY } from './mockData';
import * as api from './api';
import type { BillInput } from './api';

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
  | 'admin-combined'
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

// ---------------------------------------------------------------------------
// Session credentials. The frontend never invents ids/codes — they come from
// the API. We keep the current house id + whichever codes the user holds, and
// persist them so a refresh reconnects to the same live house.
// ---------------------------------------------------------------------------

interface Session {
  houseId: string;
  memberCode: string | null;
  adminCode: string | null;
}

const SESSION_KEY = 'kongsi.session';

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore storage failures */
  }
}

/**
 * True when the app was opened via the invite link (the `/join` path, which
 * carries ?house= & ?code=). The stack router has no URL mapping, so without
 * this a cold device would land on the Hub and never reach the join screen —
 * the join screen itself then reads the query params and joins (see MemberJoin).
 */
function isJoinLink(): boolean {
  try {
    if (window.location.pathname.replace(/\/+$/, '').endsWith('/join')) return true;
    const p = new URLSearchParams(window.location.search);
    return !!p.get('house') && !!p.get('code');
  } catch {
    return false;
  }
}

interface AppContextValue {
  house: HouseState;
  /** Admin code if the current user holds it (only the admin does). */
  adminCode: string | null;
  /** True once connected to a real house (vs. the offline demo seed). */
  connected: boolean;
  today: string;
  route: Route;
  currentMemberId: string | null;
  error: string | null;
  busy: boolean;
  // navigation
  go: (route: Route) => void;
  back: () => void;
  home: () => void;
  canGoBack: boolean;
  // identity
  setCurrentMember: (id: string) => void;
  // house lifecycle
  createHouse: (displayName: string) => Promise<api.CreatedHouse>;
  joinHouse: (houseId: string, code: string) => Promise<void>;
  // mutations (all persist through the Worker when connected)
  addMember: (name: string) => Promise<Member>;
  softRemoveMember: (memberId: string) => Promise<void>;
  setPresence: (memberId: string, ranges: DateRange[]) => Promise<void>;
  /** Mark a member's days as reviewed-correct (readiness). */
  confirmDays: (memberId: string) => Promise<void>;
  upsertBill: (input: BillInput) => Promise<string>;
  deleteBill: (billId: string) => Promise<void>;
  setBillStatus: (billId: string, status: BillStatus) => Promise<void>;
  /** Confirm (or reopen) every bill at once — sets all to the given status. */
  setAllBillsStatus: (status: BillStatus) => Promise<void>;
  regenerateMemberCode: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [house, setHouse] = useState<HouseState>(initialHouse);
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [adminCode, setAdminCode] = useState<string | null>(() => {
    const s = loadSession();
    // A persisted real session carries its own (possibly null) admin code. Only
    // the offline demo seed gets the demo admin code.
    return s ? s.adminCode : initialAdminCode;
  });
  const [stack, setStack] = useState<Route[]>(() =>
    isJoinLink() ? [{ name: 'member-join' }] : [{ name: 'hub' }]
  );
  const [currentMemberId, setCurrentMemberId] = useState<string | null>('m-bob');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connected = session !== null;
  const route = stack[stack.length - 1];

  const codes = useMemo(
    () => ({ memberCode: session?.memberCode ?? null, adminCode }),
    [session, adminCode]
  );

  /** Pull authoritative state from the Worker for the connected house. */
  const refresh = useCallback(async () => {
    if (!session) return;
    const state = await api.getHouseState(session.houseId, {
      memberCode: session.memberCode,
      adminCode,
    });
    setHouse(state);
  }, [session, adminCode]);

  // On first load (or whenever the session changes), reconnect to the live house.
  useEffect(() => {
    if (!session) return;
    refresh().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load house'));
  }, [session, refresh]);

  /** Run an async action with shared busy/error handling. */
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong';
      setError(message);
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const go = (r: Route) => setStack((s) => [...s, r]);
    const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    const home = () => setStack([{ name: 'hub' }]);

    const createHouse = (displayName: string) =>
      run(async () => {
        const created = await api.createHouse(displayName);
        const next: Session = {
          houseId: created.house_id,
          memberCode: created.member_code,
          adminCode: created.admin_code,
        };
        saveSession(next);
        setSession(next);
        setAdminCode(created.admin_code);
        setHouse({
          house_id: created.house_id,
          display_name: created.display_name,
          member_code: created.member_code,
          created_at: created.created_at,
          members: [],
          bills: [],
        });
        setCurrentMemberId(null);
        return created;
      });

    const joinHouse = (houseId: string, code: string) =>
      run(async () => {
        // Try the code as a member code first; the Worker accepts the admin
        // code here too, but we only ever hold the admin code from creation.
        const state = await api.getHouseState(houseId, { memberCode: code });
        const next: Session = { houseId, memberCode: code, adminCode: null };
        saveSession(next);
        setSession(next);
        setAdminCode(null);
        setHouse(state);
      });

    const requireAdmin = (): string => {
      if (!adminCode) throw new Error('Admin code required for this action');
      return adminCode;
    };

    const addMember = (name: string) =>
      run(async () => {
        let member: Member;
        if (connected && session) {
          const created = await api.addMember(session.houseId, name, requireAdmin());
          member = { ...created, presence: [] };
        } else {
          // Offline demo seed: no backend, so mint a local-only member.
          member = {
            member_id: 'm-' + Date.now(),
            name,
            active: true,
            days_confirmed: false,
            presence: [],
          };
        }
        setHouse((h) => ({ ...h, members: [...h.members, member] }));
        return member;
      });

    const softRemoveMember = (memberId: string) =>
      run(async () => {
        if (connected && session) {
          await api.removeMember(session.houseId, memberId, requireAdmin());
        }
        setHouse((h) => ({
          ...h,
          members: h.members.map((m) =>
            m.member_id === memberId ? { ...m, active: false } : m
          ),
        }));
      });

    const setPresence = (memberId: string, ranges: DateRange[]) =>
      run(async () => {
        let saved = ranges;
        if (connected && session) {
          const res = await api.setPresence(session.houseId, memberId, ranges, codes);
          saved = res.presence; // server merges overlaps; trust its result
        }
        // Editing days un-confirms the member (matches the Worker).
        setHouse((h) => ({
          ...h,
          members: h.members.map((m) =>
            m.member_id === memberId ? { ...m, presence: saved, days_confirmed: false } : m
          ),
        }));
      });

    const confirmDays = (memberId: string) =>
      run(async () => {
        if (connected && session) {
          await api.confirmDays(session.houseId, memberId, codes);
        }
        setHouse((h) => ({
          ...h,
          members: h.members.map((m) =>
            m.member_id === memberId ? { ...m, days_confirmed: true } : m
          ),
        }));
      });

    const upsertBill = (input: BillInput) =>
      run(async () => {
        let bill: Bill;
        if (connected && session) {
          bill = await api.upsertBill(session.houseId, input, requireAdmin());
        } else {
          bill = {
            bill_id: input.bill_id ?? 'bill-' + Date.now(),
            utility_label: input.utility_label,
            amount: input.amount,
            period_start: input.period_start,
            period_end: input.period_end,
            status: input.status ?? 'draft',
          };
        }
        setHouse((h) => {
          const exists = h.bills.some((b) => b.bill_id === bill.bill_id);
          return {
            ...h,
            bills: exists
              ? h.bills.map((b) => (b.bill_id === bill.bill_id ? bill : b))
              : [bill, ...h.bills],
          };
        });
        return bill.bill_id;
      });

    const deleteBill = (billId: string) =>
      run(async () => {
        if (connected && session) {
          await api.deleteBill(session.houseId, billId, requireAdmin());
        }
        setHouse((h) => ({
          ...h,
          bills: h.bills.filter((b) => b.bill_id !== billId),
        }));
      });

    // Status flips between draft and confirmed. 'confirmed' acts as a lock the
    // member-facing UI honours; the admin can always reopen (back to draft).
    const setBillStatus = (billId: string, status: BillStatus) =>
      run(async () => {
        const current = house.bills.find((b) => b.bill_id === billId);
        if (!current) return;
        const next: Bill = { ...current, status };
        if (connected && session) {
          const saved = await api.upsertBill(
            session.houseId,
            {
              bill_id: next.bill_id,
              utility_label: next.utility_label,
              amount: next.amount,
              period_start: next.period_start,
              period_end: next.period_end,
              status: next.status,
            },
            requireAdmin()
          );
          setHouse((h) => ({
            ...h,
            bills: h.bills.map((x) => (x.bill_id === saved.bill_id ? saved : x)),
          }));
        } else {
          setHouse((h) => ({
            ...h,
            bills: h.bills.map((x) => (x.bill_id === billId ? next : x)),
          }));
        }
      });

    const setAllBillsStatus = (status: BillStatus) =>
      run(async () => {
        const targets = house.bills.filter((b) => b.status !== status);
        if (connected && session) {
          for (const b of targets) {
            await api.upsertBill(
              session.houseId,
              {
                bill_id: b.bill_id,
                utility_label: b.utility_label,
                amount: b.amount,
                period_start: b.period_start,
                period_end: b.period_end,
                status,
              },
              requireAdmin()
            );
          }
        }
        setHouse((h) => ({
          ...h,
          bills: h.bills.map((b) => ({ ...b, status })),
        }));
      });

    const regenerateMemberCode = () =>
      run(async () => {
        if (connected && session) {
          const res = await api.regenerateMemberCode(session.houseId, requireAdmin());
          setSession((s) => {
            const next = s ? { ...s, memberCode: res.member_code } : s;
            saveSession(next);
            return next;
          });
          setHouse((h) => ({ ...h, member_code: res.member_code }));
        }
      });

    return {
      house,
      adminCode,
      connected,
      today: TODAY,
      route,
      currentMemberId,
      error,
      busy,
      go,
      back,
      home,
      canGoBack: stack.length > 1,
      setCurrentMember: setCurrentMemberId,
      createHouse,
      joinHouse,
      addMember,
      softRemoveMember,
      setPresence,
      confirmDays,
      upsertBill,
      deleteBill,
      setBillStatus,
      setAllBillsStatus,
      regenerateMemberCode,
    };
  }, [house, stack, route, currentMemberId, adminCode, connected, session, codes, error, busy, run]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
