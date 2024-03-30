import { Handlers, PageProps } from 'fresh/server.ts';

import { Calendar, CalendarEvent, FreshContextState } from '/lib/types.ts';
import { convertFormDataToObject } from '/lib/utils/misc.ts';
import { getCalendarEvent, getCalendars, updateCalendarEvent } from '/lib/data/calendar.ts';
import { getFormDataField } from '/lib/form-utils.tsx';
import ViewCalendarEvent, { formFields } from '/islands/calendar/ViewCalendarEvent.tsx';

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

    const { calendarEventId } = context.params;

    const calendarEvent = await getCalendarEvent(calendarEventId, context.state.user.id);

    if (!calendarEvent) {
      return new Response('Not found', { status: 404 });
    }

    const calendars = await getCalendars(context.state.user.id);

    return await context.render({ calendarEvent, calendars, formData: {} });
  },
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const { calendarEventId } = context.params;

    const calendarEvent = await getCalendarEvent(calendarEventId, context.state.user.id);

    if (!calendarEvent) {
      return new Response('Not found', { status: 404 });
    }

    const calendars = await getCalendars(context.state.user.id);

    const formData = await request.formData();

    calendarEvent.title = getFormDataField(formData, 'title');
    calendarEvent.start_date = new Date(getFormDataField(formData, 'start_date'));
    calendarEvent.end_date = new Date(getFormDataField(formData, 'end_date'));
    calendarEvent.is_all_day = getFormDataField(formData, 'is_all_day') === 'true';
    calendarEvent.status = getFormDataField(formData, 'status') as CalendarEvent['status'];

    calendarEvent.extra.description = getFormDataField(formData, 'description') || undefined;
    calendarEvent.extra.url = getFormDataField(formData, 'url') || undefined;
    calendarEvent.extra.location = getFormDataField(formData, 'location') || undefined;
    calendarEvent.extra.transparency =
      getFormDataField(formData, 'transparency') as CalendarEvent['extra']['transparency'] || 'default';

    const newCalendarId = getFormDataField(formData, 'calendar_id');
    let oldCalendarId: string | undefined;

    if (newCalendarId !== calendarEvent.calendar_id) {
      oldCalendarId = calendarEvent.calendar_id;
    }

    calendarEvent.calendar_id = newCalendarId;

    try {
      if (!calendarEvent.title) {
        throw new Error(`Title is required.`);
      }

      formFields(calendarEvent, calendars).forEach((field) => {
        if (field.required) {
          const value = formData.get(field.name);

          if (!value) {
            throw new Error(`${field.label} is required`);
          }
        }
      });

      await updateCalendarEvent(calendarEvent, oldCalendarId);

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
        error: error.toString(),
        formData: convertFormDataToObject(formData),
      });
    }
  },
};

export default function ContactsPage({ data }: PageProps<Data, FreshContextState>) {
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
