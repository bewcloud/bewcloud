import { RouteHandler } from 'fresh';

import { FreshContextState } from '/lib/types.ts';
import { Calendar, CalendarModel } from '/lib/models/calendar.ts';
import { CALENDAR_COLOR_OPTIONS, getColorAsHex } from '/lib/utils/calendar.ts';

interface Data {}

export interface RequestBody {
  name: string;
}

export interface ResponseBody {
  success: boolean;
  newCalendars: Calendar[];
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async POST(context) {
    const request = context.req;

    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (requestBody.name) {
      const randomColor = CALENDAR_COLOR_OPTIONS[Math.floor(Math.random() * CALENDAR_COLOR_OPTIONS.length)];
      await CalendarModel.create(context.state.user.id, requestBody.name, getColorAsHex(randomColor));
    }

    const newCalendars = await CalendarModel.list(context.state.user.id);

    const responseBody: ResponseBody = { success: true, newCalendars };

    return new Response(JSON.stringify(responseBody));
  },
};
