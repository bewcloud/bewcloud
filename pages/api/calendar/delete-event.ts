import page, { RequestHandlerParams } from '/lib/page.ts';

import { CalendarEvent, CalendarEventModel, CalendarModel } from '/lib/models/calendar.ts';
import { getDateRangeForCalendarView } from '/public/ts/utils/calendar.ts';
import { AppConfig } from '/lib/config.ts';

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

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('calendar'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (
    !requestBody.calendarId || !requestBody.calendarIds || !requestBody.calendarEventId ||
    !requestBody.calendarEventId ||
    !requestBody.calendarView || !requestBody.calendarStartDate
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  const calendar = await CalendarModel.get(user!.id, requestBody.calendarId);

  if (!calendar) {
    return new Response('Not Found', { status: 404 });
  }

  const calendarEvent = await CalendarEventModel.get(
    user!.id,
    calendar.uid!,
    requestBody.calendarEventId,
  );

  if (!calendarEvent || requestBody.calendarId !== calendarEvent.calendarId) {
    return new Response('Not Found', { status: 404 });
  }

  await CalendarEventModel.delete(user!.id, calendarEvent.url);

  const dateRange = getDateRangeForCalendarView(requestBody.calendarStartDate, requestBody.calendarView);

  const newCalendarEvents = await CalendarEventModel.list(user!.id, requestBody.calendarIds, dateRange);

  const responseBody: ResponseBody = { success: true, newCalendarEvents };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
