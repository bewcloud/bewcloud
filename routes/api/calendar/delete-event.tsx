import { Handlers } from 'fresh/server.ts';

import { CalendarEvent, FreshContextState } from '/lib/types.ts';
import { deleteCalendarEvent, getCalendar, getCalendarEvent, getCalendarEvents } from '/lib/data/calendar.ts';

interface Data {}

export interface RequestBody {
  calendarIds: string[];
  calendarView: 'day' | 'week' | 'month';
  calendarStartDate: string;
  calendarId: string;
  calendarEventId: string;
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
      !requestBody.calendarId || !requestBody.calendarIds || !requestBody.calendarEventId ||
      !requestBody.calendarEventId ||
      !requestBody.calendarView || !requestBody.calendarStartDate
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    const calendar = await getCalendar(requestBody.calendarId, context.state.user.id);

    if (!calendar) {
      return new Response('Not Found', { status: 404 });
    }

    const calendarEvent = await getCalendarEvent(
      requestBody.calendarEventId,
      requestBody.calendarId,
      context.state.user.id,
    );

    if (!calendarEvent) {
      return new Response('Not Found', { status: 404 });
    }

    await deleteCalendarEvent(requestBody.calendarEventId, requestBody.calendarId, context.state.user.id);

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
