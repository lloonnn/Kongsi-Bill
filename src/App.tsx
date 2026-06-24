import type { ReactElement } from 'react';
import { AppProvider, useApp, type RouteName } from './store';
import { Hub } from './screens/Hub';
import { MemberJoin } from './screens/MemberJoin';
import { MemberLanding } from './screens/MemberLanding';
import { AdminSetup } from './screens/AdminSetup';
import { AdminDashboard } from './screens/AdminDashboard';
import { AdminAddBill } from './screens/AdminAddBill';
import { AdminCalculate } from './screens/AdminCalculate';
import { AdminHistory } from './screens/AdminHistory';
import { AdminBillDetail } from './screens/AdminBillDetail';
import { AdminExport } from './screens/AdminExport';
import { AdminChangeLog } from './screens/AdminChangeLog';
import { AdminMembers } from './screens/AdminMembers';
import { AdminRegenerate } from './screens/AdminRegenerate';

const SCREENS: Record<RouteName, () => ReactElement> = {
  hub: Hub,
  'member-join': MemberJoin,
  'member-landing': MemberLanding,
  'admin-setup': AdminSetup,
  'admin-dashboard': AdminDashboard,
  'admin-add-bill': AdminAddBill,
  'admin-calculate': AdminCalculate,
  'admin-history': AdminHistory,
  'admin-bill-detail': AdminBillDetail,
  'admin-export': AdminExport,
  'admin-changelog': AdminChangeLog,
  'admin-members': AdminMembers,
  'admin-regenerate': AdminRegenerate,
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
