import page, { RequestHandlerParams } from '/lib/page.ts';

import { CalendarEvent, CalendarEventModel, CalendarModel } from '/lib/models/calendar.ts';
import { concurrentPromises } from '/public/ts/utils/misc.ts';
import { getDateRangeForCalendarView, getIdFromVEvent, splitTextIntoVEvents } from '/public/ts/utils/calendar.ts';
import { AppConfig } from '/lib/config.ts';

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

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('calendar'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (
    !requestBody.calendarId || !requestBody.calendarIds || !requestBody.icsToImport ||
    !requestBody.calendarView || !requestBody.calendarStartDate
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  const calendar = await CalendarModel.get(user!.id, requestBody.calendarId);

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

      await CalendarEventModel.create(user!.id, calendar.uid!, eventId, vEvent);
    }),
    5,
  );

  const dateRange = getDateRangeForCalendarView(requestBody.calendarStartDate, requestBody.calendarView);

  const newCalendarEvents = await CalendarEventModel.list(user!.id, requestBody.calendarIds, dateRange);

  const responseBody: ResponseBody = { success: true, newCalendarEvents };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
