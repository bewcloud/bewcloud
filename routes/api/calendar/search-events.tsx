import { RouteHandler } from 'fresh';

import { FreshContextState } from '/lib/types.ts';
import { CalendarEvent, CalendarEventModel } from '/lib/models/calendar.ts';

interface Data {}

export interface RequestBody {
  calendarIds: string[];
  searchTerm: string;
}

export interface ResponseBody {
  success: boolean;
  matchingCalendarEvents: CalendarEvent[];
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async POST(context) {
    const request = context.req;

    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (
      !requestBody.calendarIds || !requestBody.searchTerm
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    const allCalendarEvents = await CalendarEventModel.list(
      context.state.user.id,
      requestBody.calendarIds,
    );

    const lowerSearchTerm = requestBody.searchTerm.toLowerCase();

    const matchingCalendarEvents = allCalendarEvents.filter((calendarEvent) =>
      calendarEvent.title.toLowerCase().includes(lowerSearchTerm) ||
      calendarEvent.description?.toLowerCase().includes(lowerSearchTerm) ||
      calendarEvent.location?.toLowerCase().includes(lowerSearchTerm) ||
      calendarEvent.eventUrl?.toLowerCase().includes(lowerSearchTerm) ||
      calendarEvent.organizerEmail?.toLowerCase().includes(lowerSearchTerm) ||
      calendarEvent.attendees?.some((attendee) => attendee.email.toLowerCase().includes(lowerSearchTerm)) ||
      calendarEvent.reminders?.some((reminder) => reminder.description?.toLowerCase().includes(lowerSearchTerm))
    ).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    const responseBody: ResponseBody = { success: true, matchingCalendarEvents };

    return new Response(JSON.stringify(responseBody));
  },
};
