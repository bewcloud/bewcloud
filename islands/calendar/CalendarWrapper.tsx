import { Calendar, CalendarEvent } from '/lib/types.ts';
import MainCalendar from '/components/calendar/MainCalendar.tsx';

interface CalendarWrapperProps {
  initialCalendars: Pick<Calendar, 'id' | 'name' | 'color' | 'is_visible' | 'extra'>[];
  initialCalendarEvents: CalendarEvent[];
  view: 'day' | 'week' | 'month';
  startDate: string;
}

// This wrapper is necessary because islands need to be the first frontend component, but they don't support functions as props, so the more complex logic needs to live in the component itself
export default function CalendarWrapper(
  { initialCalendars, initialCalendarEvents, view, startDate }: CalendarWrapperProps,
) {
  return (
    <MainCalendar
      initialCalendars={initialCalendars}
      initialCalendarEvents={initialCalendarEvents}
      view={view}
      startDate={startDate}
    />
  );
}
