import { Handlers } from 'fresh/server.ts';

import { Calendar, FreshContextState } from '/lib/types.ts';
import { createCalendar, getCalendars } from '/lib/data/calendar.ts';

interface Data {}

export interface RequestBody {
  name: string;
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

    if (requestBody.name) {
      const newCalendar = await createCalendar(context.state.user.id, requestBody.name);

      if (!newCalendar) {
        return new Response('Not found', { status: 404 });
      }
    }

    const newCalendars = await getCalendars(context.state.user.id);

    const responseBody: ResponseBody = { success: true, newCalendars };

    return new Response(JSON.stringify(responseBody));
  },
};
