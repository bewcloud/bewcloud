import { Handlers } from 'fresh/server.ts';

import { CalendarEvent, FreshContextState } from '/lib/types.ts';
import { getCalendarEvents } from '/lib/data/calendar.ts';

interface Data {}

export interface RequestBody {
  calendarIds: string[];
}

export interface ResponseBody {
  success: boolean;
  calendarEvents: CalendarEvent[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (!requestBody.calendarIds) {
      return new Response('Bad Request', { status: 400 });
    }

    const calendarEvents = await getCalendarEvents(
      context.state.user.id,
      requestBody.calendarIds,
    );

    const responseBody: ResponseBody = { success: true, calendarEvents };

    return new Response(JSON.stringify(responseBody));
  },
};
