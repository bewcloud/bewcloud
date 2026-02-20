import page, { RequestHandlerParams } from '/lib/page.ts';

import { CalendarEvent, CalendarEventModel } from '/lib/models/calendar.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  calendarIds: string[];
  searchTerm: string;
}

export interface ResponseBody {
  success: boolean;
  matchingCalendarEvents: CalendarEvent[];
}

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('calendar'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (
    !requestBody.calendarIds || !requestBody.searchTerm
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  const allCalendarEvents = await CalendarEventModel.list(
    user!.id,
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
}

export default page({
  post,
  accessMode: 'user',
});
