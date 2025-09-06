import { Handlers } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { CalendarEvent, CalendarEventModel, CalendarModel } from '/lib/models/calendar.ts';
import { generateVCalendar, getDateRangeForCalendarView } from '/lib/utils/calendar.ts';

interface Data {}

export interface RequestBody {
  calendarIds: string[];
  calendarView: 'day' | 'week' | 'month';
  calendarStartDate: string;
  calendarId: string;
  title: string;
  startDate: string;
  endDate: string;
  isAllDay?: boolean;
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
      !requestBody.calendarId || !requestBody.calendarIds || !requestBody.title || !requestBody.startDate ||
      !requestBody.endDate || !requestBody.calendarView || !requestBody.calendarStartDate
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    const calendar = await CalendarModel.get(context.state.user.id, requestBody.calendarId);

    if (!calendar) {
      return new Response('Not Found', { status: 404 });
    }

    const userId = context.state.user.id;

    const eventId = crypto.randomUUID();

    const newEvent: CalendarEvent = {
      calendarId: requestBody.calendarId,
      title: requestBody.title,
      startDate: new Date(requestBody.startDate),
      endDate: new Date(requestBody.endDate),
      isAllDay: Boolean(requestBody.isAllDay),
      organizerEmail: context.state.user.email,
      transparency: 'opaque',
      url: `${calendar.url}/${eventId}.ics`,
      uid: eventId,
    };

    const vCalendar = generateVCalendar([newEvent]);

    await CalendarEventModel.create(userId, requestBody.calendarId, eventId, vCalendar);

    const dateRange = getDateRangeForCalendarView(requestBody.calendarStartDate, requestBody.calendarView);

    const newCalendarEvents = await CalendarEventModel.list(userId, requestBody.calendarIds, dateRange);

    const responseBody: ResponseBody = { success: true, newCalendarEvents };

    return new Response(JSON.stringify(responseBody));
  },
};
