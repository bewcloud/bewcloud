import { FreshContextState } from '/lib/types.ts';
import { Calendar, CalendarModel } from '/lib/models/calendar.ts';

interface Data {}

export interface RequestBody {
  calendarId: string;
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

    if (requestBody.calendarId) {
      const calendar = await CalendarModel.get(context.state.user.id, requestBody.calendarId);

      if (!calendar) {
        return new Response('Not found', { status: 404 });
      }

      await CalendarModel.delete(context.state.user.id, requestBody.calendarId);
    }

    const newCalendars = await CalendarModel.list(context.state.user.id);

    const responseBody: ResponseBody = { success: true, newCalendars };

    return new Response(JSON.stringify(responseBody));
  },
};
