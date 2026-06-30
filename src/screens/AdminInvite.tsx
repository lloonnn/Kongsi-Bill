import { useApp } from '../store';
import { Frame, ScreenNav, TopBar } from '../ui';
import { ShareCodes } from '../ShareCodes';

/** Admin invite screen — the join link and member code to share, copyable. */
export function AdminInvite() {
  const { house } = useApp();

  return (
    <Frame>
      <TopBar name={house.display_name} sub="Invite housemates" admin />
      <div className="screen">
        <ScreenNav />
        <div className="card admin">
          <div className="eyebrow-pill admin">🔗 Invite</div>
          <h1 className="title sm">Add more housemates</h1>
          <p className="sub">
            Share either the link or the code — both lead to this house. Anyone in
            the house can pass these on.
          </p>
        </div>
        <ShareCodes title="Link &amp; join code" />
      </div>
    </Frame>
  );
}
