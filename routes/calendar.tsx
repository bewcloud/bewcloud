import { PageProps, RouteHandler } from 'fresh';

import { FreshContextState } from '/lib/types.ts';
import { Calendar, CalendarEvent, CalendarEventModel, CalendarModel } from '/lib/models/calendar.ts';
import CalendarWrapper from '/islands/calendar/CalendarWrapper.tsx';
import { AppConfig } from '/lib/config.ts';
import { CALENDAR_COLOR_OPTIONS, getColorAsHex, getDateRangeForCalendarView } from '/lib/utils/calendar.ts';

interface Data {
  userCalendars: Calendar[];
  userCalendarEvents: CalendarEvent[];
  baseUrl: string;
  view: 'day' | 'week' | 'month';
  startDate: string;
  timezoneId: string;
  timezoneUtcOffset: number;
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async GET(context) {
    const request = context.req;

    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const baseUrl = (await AppConfig.getConfig()).auth.baseUrl;
    const calendarConfig = await AppConfig.getCalendarConfig();

    if (!calendarConfig.enableCalDavServer) {
      throw new Error('CalDAV server is not enabled');
    }

    const userId = context.state.user.id;
    const timezoneId = context.state.user.extra.timezone?.id || 'UTC';
    const timezoneUtcOffset = context.state.user.extra.timezone?.utcOffset || 0;

    const searchParams = new URL(request.url).searchParams;

    const view = (searchParams.get('view') as Data['view']) || 'week';
    const startDate = searchParams.get('startDate') || new Date().toISOString().substring(0, 10);

    let userCalendars = await CalendarModel.list(userId);

    // Create default calendar if none exists
    if (userCalendars.length === 0) {
      const randomColor = CALENDAR_COLOR_OPTIONS[Math.floor(Math.random() * CALENDAR_COLOR_OPTIONS.length)];
      await CalendarModel.create(userId, 'Calendar', getColorAsHex(randomColor));

      userCalendars = await CalendarModel.list(userId);
    }

    const visibleCalendarIds = userCalendars.filter((calendar) => calendar.isVisible).map((calendar) => calendar.uid!);

    const dateRange = getDateRangeForCalendarView(startDate, view);

    const userCalendarEvents = await CalendarEventModel.list(userId, visibleCalendarIds, dateRange);

    return {
      data: {
        userCalendars,
        userCalendarEvents,
        baseUrl,
        view,
        startDate,
        timezoneId,
        timezoneUtcOffset,
      },
    };
  },
};

export default function ContactsPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <CalendarWrapper
        initialCalendars={data?.userCalendars || []}
        initialCalendarEvents={data?.userCalendarEvents || []}
        baseUrl={data.baseUrl}
        view={data.view}
        startDate={data.startDate}
        timezoneId={data.timezoneId}
        timezoneUtcOffset={data.timezoneUtcOffset}
      />
    </main>
  );
}
