import { renderToString } from 'preact-render-to-string';

import { basicLayoutResponse, renderHydratableComponent } from '/lib/utils/layout.tsx';
import page, { RequestHandlerParams } from '/lib/page.ts';

import { Dashboard } from '/lib/types.ts';
import { DashboardModel } from '/lib/models/dashboard.ts';
import Notes from '/islands/dashboard/Notes.tsx';
import Links from '/islands/dashboard/Links.tsx';

const titlePrefix = 'Dashboard';
const description = 'User dashboard';

async function get({ request, match, user, isRunningLocally }: RequestHandlerParams) {
  if (!user) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
  }

  let userDashboard = await DashboardModel.getByUserId(user.id);

  if (!userDashboard) {
    userDashboard = await DashboardModel.create(user.id);
  }

  const htmlContent = renderToString(<DashboardPage userDashboard={userDashboard} />);

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix,
    description,
    user,
    request,
    match,
    isRunningLocally,
  });
}

function DashboardPage({
  userDashboard,
}: {
  userDashboard: Dashboard;
}) {
  const initialNotes = userDashboard?.data?.notes || 'Jot down some notes here.';

  return (
    <main>
      {renderHydratableComponent(Links, { initialLinks: userDashboard?.data?.links || [] })}
      {renderHydratableComponent(Notes, { initialNotes })}
    </main>
  );
}

const dashboardPage = page({
  get,
  accessMode: 'user',
});

export default dashboardPage;
