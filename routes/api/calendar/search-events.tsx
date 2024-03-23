import { Handlers } from 'fresh/server.ts';

import { CalendarEvent, FreshContextState } from '/lib/types.ts';
import { searchCalendarEvents } from '/lib/data/calendar.ts';

interface Data {}

export interface RequestBody {
  calendarIds: string[];
  searchTerm: string;
}

export interface ResponseBody {
  success: boolean;
  matchingCalendarEvents: CalendarEvent[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (
      !requestBody.calendarIds || !requestBody.searchTerm
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    const matchingCalendarEvents = await searchCalendarEvents(
      requestBody.searchTerm,
      context.state.user.id,
      requestBody.calendarIds,
    );

    const responseBody: ResponseBody = { success: true, matchingCalendarEvents };

    return new Response(JSON.stringify(responseBody));
  },
};
