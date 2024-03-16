import { Handlers, PageProps } from 'fresh/server.ts';

import { Dashboard, FreshContextState } from '/lib/types.ts';
import { createDashboard, getDashboardByUserId } from '/lib/data/dashboard.ts';
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

    let userDashboard = await getDashboardByUserId(context.state.user.id);

    if (!userDashboard) {
      userDashboard = await createDashboard(context.state.user.id);
    }

    return await context.render({ userDashboard });
  },
};

export default function Dashboard({ data }: PageProps<Data, FreshContextState>) {
  const initialNotes = data?.userDashboard?.data?.notes || 'Jot down some notes here.';

  return (
    <main>
      <Links initialLinks={data?.userDashboard?.data?.links || []} />

      <Notes initialNotes={initialNotes} />
    </main>
  );
}
