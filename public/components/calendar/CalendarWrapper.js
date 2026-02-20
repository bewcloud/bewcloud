import MainCalendar from "/public/components/calendar/MainCalendar.js";
export default function CalendarWrapper({
  initialCalendars,
  initialCalendarEvents,
  view,
  startDate,
  baseUrl,
  timezoneId,
  timezoneUtcOffset
}) {
  return h(MainCalendar, {
    initialCalendars: initialCalendars,
    initialCalendarEvents: initialCalendarEvents,
    view: view,
    startDate: startDate,
    baseUrl: baseUrl,
    timezoneId: timezoneId,
    timezoneUtcOffset: timezoneUtcOffset
  });
}