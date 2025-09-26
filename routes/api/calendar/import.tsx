import { RouteHandler } from 'fresh';

import { FreshContextState } from '/lib/types.ts';
import { CalendarEvent, CalendarEventModel, CalendarModel } from '/lib/models/calendar.ts';
import { concurrentPromises } from '/lib/utils/misc.ts';
import { getDateRangeForCalendarView, getIdFromVEvent, splitTextIntoVEvents } from '/lib/utils/calendar.ts';

interface Data {}

export interface RequestBody {
  calendarIds: string[];
  calendarView: 'day' | 'week' | 'month';
  calendarStartDate: string;
  icsToImport: string;
  calendarId: string;
}

export interface ResponseBody {
  success: boolean;
  newCalendarEvents: CalendarEvent[];
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async POST(context) {
    const request = context.req;

    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (
      !requestBody.calendarId || !requestBody.calendarIds || !requestBody.icsToImport ||
      !requestBody.calendarView || !requestBody.calendarStartDate
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    const calendar = await CalendarModel.get(context.state.user.id, requestBody.calendarId);

    if (!calendar) {
      return new Response('Not Found', { status: 404 });
    }

    const vEvents = splitTextIntoVEvents(requestBody.icsToImport);

    if (vEvents.length === 0) {
      return new Response('Not found', { status: 404 });
    }

    await concurrentPromises(
      vEvents.map((vEvent) => async () => {
        const eventId = getIdFromVEvent(vEvent);

        await CalendarEventModel.create(context.state.user!.id, calendar.uid!, eventId, vEvent);
      }),
      5,
    );

    const dateRange = getDateRangeForCalendarView(requestBody.calendarStartDate, requestBody.calendarView);

    const newCalendarEvents = await CalendarEventModel.list(context.state.user.id, requestBody.calendarIds, dateRange);

    const responseBody: ResponseBody = { success: true, newCalendarEvents };

    return new Response(JSON.stringify(responseBody));
  },
};
