import { Handlers, PageProps } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { Calendar, CalendarModel } from '/lib/models/calendar.ts';
import Calendars from '/islands/calendar/Calendars.tsx';
import { AppConfig } from '/lib/config.ts';

interface Data {
  userCalendars: Calendar[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const calendarConfig = await AppConfig.getCalendarConfig();

    if (!calendarConfig.enableCalDavServer) {
      throw new Error('CalDAV server is not enabled');
    }

    const userCalendars = await CalendarModel.list(context.state.user.id);

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
