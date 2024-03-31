import { Handlers } from 'fresh/server.ts';

import { CalendarEvent, FreshContextState } from '/lib/types.ts';
import { concurrentPromises } from '/lib/utils/misc.ts';
import { createCalendarEvent, getCalendar, getCalendarEvents, updateCalendarEvent } from '/lib/data/calendar.ts';

interface Data {}

export interface RequestBody {
  calendarIds: string[];
  calendarView: 'day' | 'week' | 'month';
  calendarStartDate: string;
  partialCalendarEvents: Partial<CalendarEvent>[];
  calendarId: string;
}

export interface ResponseBody {
  success: boolean;
  newCalendarEvents: CalendarEvent[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (
      !requestBody.calendarId || !requestBody.calendarIds || !requestBody.partialCalendarEvents ||
      !requestBody.calendarView || !requestBody.calendarStartDate
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    const calendar = await getCalendar(requestBody.calendarId, context.state.user.id);

    if (!calendar) {
      return new Response('Not Found', { status: 404 });
    }

    if (requestBody.partialCalendarEvents.length === 0) {
      return new Response('Not found', { status: 404 });
    }

    await concurrentPromises(
      requestBody.partialCalendarEvents.map((partialCalendarEvent) => async () => {
        if (partialCalendarEvent.title && partialCalendarEvent.start_date && partialCalendarEvent.end_date) {
          const calendarEvent = await createCalendarEvent(
            context.state.user!.id,
            requestBody.calendarId,
            partialCalendarEvent.title,
            new Date(partialCalendarEvent.start_date),
            new Date(partialCalendarEvent.end_date),
            partialCalendarEvent.is_all_day,
          );

          const parsedExtra = JSON.stringify(partialCalendarEvent.extra || {});

          if (parsedExtra !== '{}') {
            calendarEvent.extra = partialCalendarEvent.extra!;

            if (
              calendarEvent.extra.is_recurring && calendarEvent.extra.recurring_sequence === 0 &&
              !calendarEvent.extra.recurring_id
            ) {
              calendarEvent.extra.recurring_id = calendarEvent.id;
            }

            await updateCalendarEvent(calendarEvent);
          }
        }
      }),
      5,
    );

    const dateRange = { start: new Date(requestBody.calendarStartDate), end: new Date(requestBody.calendarStartDate) };

    if (requestBody.calendarView === 'day') {
      dateRange.start.setDate(dateRange.start.getDate() - 1);
      dateRange.end.setDate(dateRange.end.getDate() + 1);
    } else if (requestBody.calendarView === 'week') {
      dateRange.start.setDate(dateRange.start.getDate() - 7);
      dateRange.end.setDate(dateRange.end.getDate() + 7);
    } else {
      dateRange.start.setDate(dateRange.start.getDate() - 7);
      dateRange.end.setDate(dateRange.end.getDate() + 31);
    }

    const newCalendarEvents = await getCalendarEvents(context.state.user.id, requestBody.calendarIds, dateRange);

    const responseBody: ResponseBody = { success: true, newCalendarEvents };

    return new Response(JSON.stringify(responseBody));
  },
};
