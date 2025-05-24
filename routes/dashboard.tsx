import { Handlers, PageProps } from 'fresh/server.ts';

import { Dashboard, FreshContextState } from '/lib/types.ts';
import { DashboardModel } from '/lib/models/dashboard.ts';
import Notes from '/islands/dashboard/Notes.tsx';
import Links from '/islands/dashboard/Links.tsx';

interface Data {
  userDashboard: Dashboard;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    let userDashboard = await DashboardModel.getByUserId(context.state.user.id);

    if (!userDashboard) {
      userDashboard = await DashboardModel.create(context.state.user.id);
    }

    return await context.render({ userDashboard });
  },
};

export default function DashboardPage({ data }: PageProps<Data, FreshContextState>) {
  const initialNotes = data?.userDashboard?.data?.notes || 'Jot down some notes here.';

  return (
    <main>
      <Links initialLinks={data?.userDashboard?.data?.links || []} />

      <Notes initialNotes={initialNotes} />
    </main>
  );
}
