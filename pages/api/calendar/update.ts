import page, { RequestHandlerParams } from '/lib/page.ts';

import { Calendar, CalendarModel } from '/lib/models/calendar.ts';
import { UserModel } from '/lib/models/user.ts';
import { CALENDAR_COLOR_OPTIONS, getColorAsHex } from '/public/ts/utils/calendar.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  id: string;
  name: string;
  color: string;
  isVisible: boolean;
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

  if (requestBody.id) {
    const calendar = await CalendarModel.get(user!.id, requestBody.id);

    if (!calendar) {
      return new Response('Not found', { status: 404 });
    }

    calendar.displayName = requestBody.name;
    calendar.calendarColor = requestBody.color?.startsWith('#')
      ? requestBody.color
      : getColorAsHex((requestBody.color || 'bg-gray-700') as typeof CALENDAR_COLOR_OPTIONS[number]);

    await CalendarModel.update(user!.id, calendar.url, calendar.displayName, calendar.calendarColor);

    if (requestBody.isVisible !== calendar.isVisible) {
      const userToUpdate = await UserModel.getById(user!.id);

      if (requestBody.isVisible) {
        userToUpdate.extra.hidden_calendar_ids = userToUpdate.extra.hidden_calendar_ids?.filter((id) =>
          id !== calendar.uid!
        );
      } else if (Array.isArray(userToUpdate.extra.hidden_calendar_ids)) {
        userToUpdate.extra.hidden_calendar_ids.push(calendar.uid!);
      } else {
        userToUpdate.extra.hidden_calendar_ids = [calendar.uid!];
      }

      await UserModel.update(userToUpdate);
    }
  }

  const newCalendars = await CalendarModel.list(user!.id);

  const responseBody: ResponseBody = { success: true, newCalendars };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
