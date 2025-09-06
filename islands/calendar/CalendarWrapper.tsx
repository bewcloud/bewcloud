import { Calendar, CalendarEvent } from '/lib/models/calendar.ts';
import MainCalendar from '/components/calendar/MainCalendar.tsx';

interface CalendarWrapperProps {
  initialCalendars: Calendar[];
  initialCalendarEvents: CalendarEvent[];
  view: 'day' | 'week' | 'month';
  startDate: string;
  baseUrl: string;
  timezoneId: string;
  timezoneUtcOffset: number;
}

// This wrapper is necessary because islands need to be the first frontend component, but they don't support functions as props, so the more complex logic needs to live in the component itself
export default function CalendarWrapper(
  { initialCalendars, initialCalendarEvents, view, startDate, baseUrl, timezoneId, timezoneUtcOffset }:
    CalendarWrapperProps,
) {
  return (
    <MainCalendar
      initialCalendars={initialCalendars}
      initialCalendarEvents={initialCalendarEvents}
      view={view}
      startDate={startDate}
      baseUrl={baseUrl}
      timezoneId={timezoneId}
      timezoneUtcOffset={timezoneUtcOffset}
    />
  );
}
