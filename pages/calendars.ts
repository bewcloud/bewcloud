import page, { RequestHandlerParams } from '/lib/page.ts';

import { Calendar, CalendarModel } from '/lib/models/calendar.ts';
import { AppConfig } from '/lib/config.ts';
import { html } from '/public/ts/utils/misc.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import Loading from '/components/Loading.ts';

const titlePrefix = 'Calendars';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams): Promise<Response> {
  const calendarConfig = await AppConfig.getCalendarConfig();

  if (!calendarConfig.enableCalDavServer) {
    throw new Error('CalDAV server is not enabled');
  }

  if (!(await AppConfig.isAppEnabled('calendar'))) {
    throw new Error('Calendar app is not enabled');
  }

  const userCalendars = await CalendarModel.list(user!.id);

  const htmlContent = defaultHtmlContent({ userCalendars });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix,
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent({ userCalendars }: { userCalendars: Calendar[] }) {
  return html`
    <main id="main">
      <section id="calendars">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import Calendars from '/public/components/calendar/Calendars.js';

    const calendarsElement = document.getElementById('calendars');

    if (calendarsElement) {
      const calendarsApp = h(Calendars, {
        initialCalendars: ${JSON.stringify(userCalendars || [])},
      });

      render(calendarsApp, calendarsElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}

export default page({
  get,
  accessMode: 'user',
});
