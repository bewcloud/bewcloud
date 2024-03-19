import { Handlers, PageProps } from 'fresh/server.ts';

import { Calendar, FreshContextState } from '/lib/types.ts';
import { getCalendars } from '/lib/data/calendar.ts';
import Calendars from '/islands/calendar/Calendars.tsx';

interface Data {
  userCalendars: Calendar[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const userCalendars = await getCalendars(context.state.user.id);

    return await context.render({ userCalendars });
  },
};

export default function CalendarsPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <Calendars initialCalendars={data.userCalendars || []} />
    </main>
  );
}
