import page, { RequestHandlerParams } from '/lib/page.ts';

import { Calendar, CalendarEvent, CalendarEventModel, CalendarModel } from '/lib/models/calendar.ts';
import { convertFormDataToObject, html } from '/public/ts/utils/misc.ts';
import { updateIcs } from '/public/ts/utils/calendar.ts';
import { getFormDataField } from '/public/ts/utils/form.ts';
import { formFields } from '/components/calendar/ViewCalendarEvent.tsx';
import { AppConfig } from '/lib/config.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import Loading from '/components/Loading.ts';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  const calendarConfig = await AppConfig.getCalendarConfig();

  if (!calendarConfig.enableCalDavServer) {
    throw new Error('CalDAV server is not enabled');
  }

  if (!(await AppConfig.isAppEnabled('calendar'))) {
    throw new Error('Calendar app is not enabled');
  }

  if (!match.pathname.groups.calendarEventId) {
    throw new Error('Calendar event ID not found');
  }

  let { calendarEventId } = match.pathname.groups;

  const searchParams = new URL(request.url).searchParams;
  const calendarId = searchParams.get('calendarId') || undefined;

  if (!calendarId) {
    return new Response('Bad request', { status: 400 });
  }

  // When editing a recurring event, we only allow the master
  if (calendarEventId.includes(':')) {
    calendarEventId = calendarEventId.split(':')[0];
  }

  const calendarEvent = await CalendarEventModel.get(user!.id, calendarId, calendarEventId);

  if (!calendarEvent) {
    throw new Error('NotFound');
  }

  const calendars = await CalendarModel.list(user!.id);

  const htmlContent = defaultHtmlContent({ calendarEvent, calendars, formData: {} });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix: `${calendarEvent.title} - Calendar Event`,
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

async function post({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  const calendarConfig = await AppConfig.getCalendarConfig();

  if (!calendarConfig.enableCalDavServer) {
    throw new Error('CalDAV server is not enabled');
  }

  if (!(await AppConfig.isAppEnabled('calendar'))) {
    throw new Error('Calendar app is not enabled');
  }

  if (!match.pathname.groups.calendarEventId) {
    throw new Error('Calendar event ID not found');
  }

  const { calendarEventId } = match.pathname.groups;

  const searchParams = new URL(request.url).searchParams;
  const calendarId = searchParams.get('calendarId') || undefined;

  if (!calendarId) {
    return new Response('Bad request', { status: 400 });
  }

  const calendarEvent = await CalendarEventModel.get(user!.id, calendarId, calendarEventId);

  if (!calendarEvent) {
    throw new Error('NotFound');
  }

  const calendars = await CalendarModel.list(user!.id);

  const formData = await request.formData();
  let errorMessage: string | undefined = undefined;
  let notice: string | undefined = undefined;

  const updateType = getFormDataField(formData, 'update-type') as 'raw' | 'ui';

  calendarEvent.title = getFormDataField(formData, 'title');
  calendarEvent.startDate = new Date(`${getFormDataField(formData, 'startDate')}:00.000Z`);
  calendarEvent.endDate = new Date(`${getFormDataField(formData, 'endDate')}:00.000Z`);
  calendarEvent.isAllDay = getFormDataField(formData, 'isAllDay') === 'true';
  calendarEvent.status = getFormDataField(formData, 'status') as CalendarEvent['status'];

  calendarEvent.description = getFormDataField(formData, 'description') || undefined;
  calendarEvent.eventUrl = getFormDataField(formData, 'eventUrl') || undefined;
  calendarEvent.location = getFormDataField(formData, 'location') || undefined;
  calendarEvent.transparency = getFormDataField(formData, 'transparency') as CalendarEvent['transparency'] ||
    'opaque';
  const rawIcs = getFormDataField(formData, 'ics');

  try {
    if (!calendarEvent.title && updateType === 'ui') {
      throw new Error(`Title is required.`);
    }

    formFields(calendarEvent, calendars, updateType).forEach((field) => {
      if (field.required) {
        const value = formData.get(field.name);

        if (!value) {
          throw new Error(`${field.label} is required`);
        }
      }
    });

    let updatedIcs = '';

    if (updateType === 'raw') {
      updatedIcs = rawIcs;
    } else if (updateType === 'ui') {
      if (!calendarEvent.title || !calendarEvent.startDate || !calendarEvent.endDate) {
        throw new Error(`Title, start date, and end date are required.`);
      }

      updatedIcs = updateIcs(calendarEvent.data || '', calendarEvent);
    }

    await CalendarEventModel.update(user!.id, calendarEvent.url!, updatedIcs);

    notice = 'Event updated successfully!';
  } catch (error) {
    console.error(error);

    errorMessage = (error as Error).toString();
  }

  const updatedCalendarEvent = (await CalendarEventModel.get(user!.id, calendarId, calendarEventId))!;

  const htmlContent = defaultHtmlContent({
    calendarEvent: updatedCalendarEvent,
    calendars,
    notice,
    error: errorMessage,
    formData: convertFormDataToObject(formData),
  });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix: `${calendarEvent.title} - Calendar Event`,
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent({ calendarEvent, calendars, error, notice, formData }: {
  calendarEvent: CalendarEvent;
  calendars: Calendar[];
  error?: string;
  notice?: string;
  formData: Record<string, any>;
}) {
  const htmlContent = html`
    <main id="main">
      <section id="view-calendar-event">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import ViewCalendarEvent from '/public/components/calendar/ViewCalendarEvent.js';

    const viewCalendarEventElement = document.getElementById('view-calendar-event');

    if (viewCalendarEventElement) {
      const viewCalendarEventApp = h(ViewCalendarEvent, {
        initialCalendarEvent: ${JSON.stringify(calendarEvent)},
        calendars: ${JSON.stringify(calendars)},
        formData: ${JSON.stringify(formData)},
        error: ${JSON.stringify(error)},
        notice: ${JSON.stringify(notice)},
      });

      render(viewCalendarEventApp, viewCalendarEventElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;

  return htmlContent;
}

export default page({
  get,
  post,
  accessMode: 'user',
});
