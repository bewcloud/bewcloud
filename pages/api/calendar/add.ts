import page, { RequestHandlerParams } from '/lib/page.ts';

import { Calendar, CalendarModel } from '/lib/models/calendar.ts';
import { CALENDAR_COLOR_OPTIONS, getColorAsHex } from '/public/ts/utils/calendar.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  name: string;
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

  if (requestBody.name) {
    const randomColor = CALENDAR_COLOR_OPTIONS[Math.floor(Math.random() * CALENDAR_COLOR_OPTIONS.length)];
    await CalendarModel.create(user!.id, requestBody.name, getColorAsHex(randomColor));
  }

  const newCalendars = await CalendarModel.list(user!.id);

  const responseBody: ResponseBody = { success: true, newCalendars };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
