import { FreshContextState } from '/lib/types.ts';
import { Calendar, CalendarModel } from '/lib/models/calendar.ts';
import { UserModel } from '/lib/models/user.ts';
import { CALENDAR_COLOR_OPTIONS, getColorAsHex } from '/lib/utils/calendar.ts';

interface Data {}

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

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (requestBody.id) {
      const calendar = await CalendarModel.get(context.state.user.id, requestBody.id);

      if (!calendar) {
        return new Response('Not found', { status: 404 });
      }

      calendar.displayName = requestBody.name;
      calendar.calendarColor = requestBody.color?.startsWith('#')
        ? requestBody.color
        : getColorAsHex((requestBody.color || 'bg-gray-700') as typeof CALENDAR_COLOR_OPTIONS[number]);

      await CalendarModel.update(context.state.user.id, calendar.url, calendar.displayName, calendar.calendarColor);

      if (requestBody.isVisible !== calendar.isVisible) {
        const user = await UserModel.getById(context.state.user.id);

        if (requestBody.isVisible) {
          user.extra.hidden_calendar_ids = user.extra.hidden_calendar_ids?.filter((id) => id !== calendar.uid!);
        } else if (Array.isArray(user.extra.hidden_calendar_ids)) {
          user.extra.hidden_calendar_ids.push(calendar.uid!);
        } else {
          user.extra.hidden_calendar_ids = [calendar.uid!];
        }

        await UserModel.update(user);
      }
    }

    const newCalendars = await CalendarModel.list(context.state.user.id);

    const responseBody: ResponseBody = { success: true, newCalendars };

    return new Response(JSON.stringify(responseBody));
  },
};
