import { Handlers, PageProps } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { Calendar, CalendarEvent, CalendarEventModel, CalendarModel } from '/lib/models/calendar.ts';
import { convertFormDataToObject } from '/lib/utils/misc.ts';
import { updateIcs } from '/lib/utils/calendar.ts';
import { getFormDataField } from '/lib/form-utils.tsx';
import ViewCalendarEvent, { formFields } from '/islands/calendar/ViewCalendarEvent.tsx';
import { AppConfig } from '/lib/config.ts';

interface Data {
  calendarEvent: CalendarEvent;
  calendars: Calendar[];
  error?: string;
  notice?: string;
  formData: Record<string, any>;
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

    if (!(await AppConfig.isAppEnabled('calendar'))) {
      throw new Error('Calendar app is not enabled');
    }

    let { calendarEventId } = context.params;

    const searchParams = new URL(request.url).searchParams;
    const calendarId = searchParams.get('calendarId') || undefined;

    if (!calendarId) {
      return new Response('Bad request', { status: 400 });
    }

    // When editing a recurring event, we only allow the master
    if (calendarEventId.includes(':')) {
      calendarEventId = calendarEventId.split(':')[0];
    }

    const calendarEvent = await CalendarEventModel.get(context.state.user.id, calendarId, calendarEventId);

    if (!calendarEvent) {
      return context.renderNotFound();
    }

    const calendars = await CalendarModel.list(context.state.user.id);

    return await context.render({ calendarEvent, calendars, formData: {} });
  },
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const calendarConfig = await AppConfig.getCalendarConfig();

    if (!calendarConfig.enableCalDavServer) {
      throw new Error('CalDAV server is not enabled');
    }

    if (!(await AppConfig.isAppEnabled('calendar'))) {
      throw new Error('Calendar app is not enabled');
    }

    const { calendarEventId } = context.params;

    const searchParams = new URL(request.url).searchParams;
    const calendarId = searchParams.get('calendarId') || undefined;

    if (!calendarId) {
      return new Response('Bad request', { status: 400 });
    }

    const calendarEvent = await CalendarEventModel.get(context.state.user.id, calendarId, calendarEventId);

    if (!calendarEvent) {
      return context.renderNotFound();
    }

    const calendars = await CalendarModel.list(context.state.user.id);

    const formData = await request.formData();

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
      if (!calendarEvent.title) {
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

      await CalendarEventModel.update(context.state.user.id, calendarEvent.url!, updatedIcs);

      return await context.render({
        calendarEvent,
        calendars,
        notice: 'Event updated successfully!',
        formData: convertFormDataToObject(formData),
      });
    } catch (error) {
      console.error(error);

      return await context.render({
        calendarEvent,
        calendars,
        error: (error as Error).toString(),
        formData: convertFormDataToObject(formData),
      });
    }
  },
};

export default function CalendarEventPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <ViewCalendarEvent
        initialCalendarEvent={data.calendarEvent}
        calendars={data.calendars}
        formData={data.formData}
        error={data.error}
        notice={data.notice}
      />
    </main>
  );
}
