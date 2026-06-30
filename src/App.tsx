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
import { AdminAddCycle } from './screens/AdminAddCycle';
import { AdminAddBill } from './screens/AdminAddBill';
import { AdminCombined } from './screens/AdminCombined';
import { AdminHistory } from './screens/AdminHistory';
import { AdminBillDetail } from './screens/AdminBillDetail';
import { AdminExport } from './screens/AdminExport';
import { AdminMembers } from './screens/AdminMembers';
import { AdminInvite } from './screens/AdminInvite';
import { AdminManage } from './screens/AdminManage';

const SCREENS: Record<RouteName, () => ReactElement> = {
  hub: Hub,
  'member-join': MemberJoin,
  'member-landing': MemberLanding,
  'member-history': MemberHistory,
  'admin-setup': AdminSetup,
  'admin-dashboard': AdminDashboard,
  'admin-my-days': AdminMyDays,
  'admin-edit-days': AdminEditDays,
  'admin-add-cycle': AdminAddCycle,
  'admin-add-bill': AdminAddBill,
  'admin-combined': AdminCombined,
  'admin-history': AdminHistory,
  'admin-bill-detail': AdminBillDetail,
  'admin-export': AdminExport,
  'admin-members': AdminMembers,
  'admin-invite': AdminInvite,
  'admin-manage': AdminManage,
};

function Router() {
  const { route } = useApp();
  const Screen = SCREENS[route.name];
  return <Screen />;
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
