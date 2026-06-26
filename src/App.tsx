import type { ReactElement } from 'react';
import { AppProvider, useApp, type RouteName } from './store';
import { Hub } from './screens/Hub';
import { MemberJoin } from './screens/MemberJoin';
import { MemberLanding } from './screens/MemberLanding';
import { MemberHistory } from './screens/MemberHistory';
import { AdminSetup } from './screens/AdminSetup';
import { AdminDashboard } from './screens/AdminDashboard';
import { AdminMyDays } from './screens/AdminMyDays';
import { AdminEditDays } from './screens/AdminEditDays';
import { AdminAddBill } from './screens/AdminAddBill';
import { AdminCombined } from './screens/AdminCombined';
import { AdminHistory } from './screens/AdminHistory';
import { AdminBillDetail } from './screens/AdminBillDetail';
import { AdminExport } from './screens/AdminExport';
import { AdminMembers } from './screens/AdminMembers';
import { AdminInvite } from './screens/AdminInvite';

const SCREENS: Record<RouteName, () => ReactElement> = {
  hub: Hub,
  'member-join': MemberJoin,
  'member-landing': MemberLanding,
  'member-history': MemberHistory,
  'admin-setup': AdminSetup,
  'admin-dashboard': AdminDashboard,
  'admin-my-days': AdminMyDays,
  'admin-edit-days': AdminEditDays,
  'admin-add-bill': AdminAddBill,
  'admin-combined': AdminCombined,
  'admin-history': AdminHistory,
  'admin-bill-detail': AdminBillDetail,
  'admin-export': AdminExport,
  'admin-members': AdminMembers,
  'admin-invite': AdminInvite,
};

// Quick jumps for click-through review (prototype scaffolding, not product).
const DEV_LINKS: { name: RouteName; label: string }[] = [
  { name: 'hub', label: 'Hub' },
  { name: 'member-join', label: 'Member join' },
  { name: 'member-landing', label: 'Member landing' },
  { name: 'admin-setup', label: 'Admin setup' },
  { name: 'admin-dashboard', label: 'Admin house' },
];

function Router() {
  const { route, go, back, canGoBack } = useApp();
  const Screen = SCREENS[route.name];

  return (
    <>
      <Screen />
      <div className="devbar">
        <button onClick={back} disabled={!canGoBack}>
          ← Back
        </button>
        <span className="devlabel">prototype nav</span>
        {DEV_LINKS.map((l) => (
          <button
            key={l.name}
            className={route.name === l.name ? 'active' : ''}
            onClick={() => go({ name: l.name })}
          >
            {l.label}
          </button>
        ))}
      </div>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
