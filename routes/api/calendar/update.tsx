import { Handlers } from 'fresh/server.ts';

import { Calendar, FreshContextState } from '/lib/types.ts';
import { getCalendar, getCalendars, updateCalendar } from '/lib/data/calendar.ts';

interface Data {}

export interface RequestBody {
  id: string;
  name: string;
  color: string;
  is_visible: boolean;
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
      const calendar = await getCalendar(requestBody.id, context.state.user.id);

      if (!calendar) {
        return new Response('Not found', { status: 404 });
      }

      calendar.name = requestBody.name;
      calendar.color = requestBody.color;
      calendar.is_visible = requestBody.is_visible;

      await updateCalendar(calendar);
    }

    const newCalendars = await getCalendars(context.state.user.id);

    const responseBody: ResponseBody = { success: true, newCalendars };

    return new Response(JSON.stringify(responseBody));
  },
};
