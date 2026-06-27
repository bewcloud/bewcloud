import page, { RequestHandlerParams } from '/lib/page.ts';

import { Calendar, CalendarModel } from '/lib/models/calendar.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  calendarId: string;
}

export interface ResponseBody {
  success: boolean;
  newCalendars: Calendar[];
}

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('calendar'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (requestBody.calendarId) {
    const calendar = await CalendarModel.get(user!.id, requestBody.calendarId);

    if (!calendar) {
      return new Response('Not found', { status: 404 });
    }

    await CalendarModel.delete(user!.id, requestBody.calendarId);
  }

  const newCalendars = await CalendarModel.list(user!.id);

  const responseBody: ResponseBody = { success: true, newCalendars };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
