import page, { RequestHandlerParams } from '/lib/page.ts';

import { CalendarEvent, CalendarEventModel } from '/lib/models/calendar.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  calendarIds: string[];
}

export interface ResponseBody {
  success: boolean;
  calendarEvents: CalendarEvent[];
}

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('calendar'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (!requestBody.calendarIds) {
    return new Response('Bad Request', { status: 400 });
  }

  const calendarEvents = await CalendarEventModel.list(
    user!.id,
    requestBody.calendarIds,
  );

  const responseBody: ResponseBody = { success: true, calendarEvents };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
