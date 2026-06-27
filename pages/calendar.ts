import page, { RequestHandlerParams } from '/lib/page.ts';

import { Calendar, CalendarEvent, CalendarEventModel, CalendarModel } from '/lib/models/calendar.ts';
import { AppConfig } from '/lib/config.ts';
import { CALENDAR_COLOR_OPTIONS, getColorAsHex, getDateRangeForCalendarView } from '/public/ts/utils/calendar.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import { html } from '/public/ts/utils/misc.ts';
import Loading from '/components/Loading.ts';

type CalendarView = 'day' | 'week' | 'month';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  const baseUrl = (await AppConfig.getConfig()).auth.baseUrl;
  const calendarConfig = await AppConfig.getCalendarConfig();

  if (!calendarConfig.enableCalDavServer) {
    throw new Error('CalDAV server is not enabled');
  }

  if (!(await AppConfig.isAppEnabled('calendar'))) {
    throw new Error('Calendar app is not enabled');
  }

  const userId = user!.id;
  const timezoneId = user!.extra.timezone?.id || 'UTC';
  const timezoneUtcOffset = user!.extra.timezone?.utcOffset || 0;

  const searchParams = new URL(request.url).searchParams;

  const view = (searchParams.get('view') as CalendarView) || 'week';
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

  const htmlContent = defaultHtmlContent({
    userCalendars,
    userCalendarEvents,
    baseUrl,
    view,
    startDate,
    timezoneId,
    timezoneUtcOffset,
  });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix: 'Calendar',
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent(
  { userCalendars, userCalendarEvents, baseUrl, view, startDate, timezoneId, timezoneUtcOffset }: {
    userCalendars: Calendar[];
    userCalendarEvents: CalendarEvent[];
    baseUrl: string;
    view: CalendarView;
    startDate: string;
    timezoneId: string;
    timezoneUtcOffset: number;
  },
) {
  return html`
    <main id="main">
      <section id="main-calendar">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import MainCalendar from '/public/components/calendar/MainCalendar.js';

    const mainCalendarElement = document.getElementById('main-calendar');

    if (mainCalendarElement) {
      const mainCalendarApp = h(MainCalendar, {
        initialCalendars: ${JSON.stringify(userCalendars || [])},
        initialCalendarEvents: ${JSON.stringify(userCalendarEvents || [])},
        baseUrl: ${JSON.stringify(baseUrl)},
        view: ${JSON.stringify(view)},
        startDate: ${JSON.stringify(startDate)},
        timezoneId: ${JSON.stringify(timezoneId)},
        timezoneUtcOffset: ${JSON.stringify(timezoneUtcOffset)},
      });

      render(mainCalendarApp, mainCalendarElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}

export default page({
  get,
  accessMode: 'user',
});
