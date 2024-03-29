import { Calendar, CalendarEvent } from '../types.ts';

export const CALENDAR_COLOR_OPTIONS = [
  'bg-red-700',
  'bg-red-950',
  'bg-orange-700',
  'bg-orange-950',
  'bg-amber-700',
  'bg-yellow-800',
  'bg-lime-700',
  'bg-lime-950',
  'bg-green-700',
  'bg-emerald-800',
  'bg-teal-700',
  'bg-cyan-700',
  'bg-sky-800',
  'bg-blue-900',
  'bg-indigo-700',
  'bg-violet-700',
  'bg-purple-800',
  'bg-fuchsia-700',
  'bg-pink-800',
  'bg-rose-700',
] as const;

// NOTE: This variable isn't really used, _but_ it allows for tailwind to include the classes without having to move this into the tailwind.config.ts file
export const CALENDAR_BORDER_COLOR_OPTIONS = [
  'border-red-700',
  'border-red-950',
  'border-orange-700',
  'border-orange-950',
  'border-amber-700',
  'border-yellow-800',
  'border-lime-700',
  'border-lime-950',
  'border-green-700',
  'border-emerald-800',
  'border-teal-700',
  'border-cyan-700',
  'border-sky-800',
  'border-blue-900',
  'border-indigo-700',
  'border-violet-700',
  'border-purple-800',
  'border-fuchsia-700',
  'border-pink-800',
  'border-rose-700',
] as const;

// TODO: Build this
export function formatCalendarEventsToVCalendar(
  calendarEvents: CalendarEvent[],
  _calendars: Pick<Calendar, 'id' | 'color' | 'is_visible'>[],
): string {
  const vCalendarText = calendarEvents.map((calendarEvent) =>
    `BEGIN:VEVENT
DTSTAMP:${new Date(calendarEvent.created_at).toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '')}
DTSTART:${new Date(calendarEvent.start_date).toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '')}
DTEND:${new Date(calendarEvent.end_date).toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '')}
ORGANIZER;CN=:MAILTO:${calendarEvent.extra.organizer_email}
SUMMARY:${calendarEvent.title}
${calendarEvent.extra.uid ? `UID:${calendarEvent.extra.uid}` : ''}
END:VEVENT`
  ).join('\n');

  return `BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\n${vCalendarText}\nEND:VCALENDAR`.split('\n').map((line) =>
    line.trim()
  ).filter(
    Boolean,
  ).join('\n');
}

type VCalendarVersion = '1.0' | '2.0';

export function parseVCalendarFromTextContents(text: string): Partial<CalendarEvent>[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  const partialCalendarEvents: Partial<CalendarEvent>[] = [];

  let partialCalendarEvent: Partial<CalendarEvent> = {};
  let vCalendarVersion: VCalendarVersion = '2.0';

  // Loop through every line
  for (const line of lines) {
    // Start new vCard version
    if (line.startsWith('BEGIN:VCALENDAR')) {
      vCalendarVersion = '2.0';
      continue;
    }

    // Start new event
    if (line.startsWith('BEGIN:VEVENT')) {
      partialCalendarEvent = {};
      continue;
    }

    // Finish contact
    if (line.startsWith('END:VEVENT')) {
      partialCalendarEvents.push(partialCalendarEvent);
      continue;
    }

    // Select proper vCalendar version
    if (line.startsWith('VERSION:')) {
      if (line.startsWith('VERSION:1.0')) {
        vCalendarVersion = '1.0';
      } else if (line.startsWith('VERSION:2.0')) {
        vCalendarVersion = '2.0';
      } else {
        // Default to 2.0, log warning
        vCalendarVersion = '2.0';
        console.warn(`Invalid vCalendar version found: "${line}". Defaulting to 2.0 parser.`);
      }

      continue;
    }

    if (vCalendarVersion !== '1.0' && vCalendarVersion !== '2.0') {
      console.warn(`Invalid vCalendar version found: "${vCalendarVersion}". Defaulting to 2.0 parser.`);
      vCalendarVersion = '2.0';
    }

    if (line.startsWith('UID:')) {
      const uid = line.replace('UID:', '');

      if (!uid) {
        continue;
      }

      partialCalendarEvent.extra = {
        ...(partialCalendarEvent.extra! || {}),
        uid,
      };

      continue;
    }

    // TODO: Build this ( https://en.wikipedia.org/wiki/ICalendar#List_of_components,_properties,_and_parameters )

    if (line.startsWith('SUMMARY:')) {
      const title = line.split('SUMMARY:')[1] || '';

      partialCalendarEvent.title = title;

      continue;
    }

    if (line.startsWith('DTSTART')) {
      const startDateInfo = line.split(':')[1] || '';
      const [dateInfo, hourInfo] = startDateInfo.split('T');

      const year = dateInfo.substring(0, 4);
      const month = dateInfo.substring(4, 6);
      const day = dateInfo.substring(6, 8);

      const hours = hourInfo.substring(0, 2);
      const minutes = hourInfo.substring(2, 4);
      const seconds = hourInfo.substring(4, 6);

      const startDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`);

      partialCalendarEvent.start_date = startDate;

      continue;
    }

    if (line.startsWith('DTEND')) {
      const endDateInfo = line.split(':')[1] || '';
      const [dateInfo, hourInfo] = endDateInfo.split('T');

      const year = dateInfo.substring(0, 4);
      const month = dateInfo.substring(4, 6);
      const day = dateInfo.substring(6, 8);

      const hours = hourInfo.substring(0, 2);
      const minutes = hourInfo.substring(2, 4);
      const seconds = hourInfo.substring(4, 6);

      const endDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`);

      partialCalendarEvent.end_date = endDate;

      continue;
    }
  }

  return partialCalendarEvents;
}

// NOTE: Considers weeks starting Monday, not Sunday
export function getWeeksForMonth(date: Date): { date: Date; isSameMonth: boolean }[][] {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const daysToShow = firstOfMonth.getDay() + (firstOfMonth.getDay() === 0 ? 6 : -1) + lastOfMonth.getDate();

  const weekCount = Math.ceil(daysToShow / 7);

  const weeks: { date: Date; isSameMonth: boolean }[][] = [];

  const startingDate = new Date(firstOfMonth);
  startingDate.setDate(
    startingDate.getDate() - Math.abs(firstOfMonth.getDay() === 0 ? 6 : (firstOfMonth.getDay() - 1)),
  );

  for (let weekIndex = 0; weeks.length < weekCount; ++weekIndex) {
    for (let dayIndex = 0; dayIndex < 7; ++dayIndex) {
      if (!Array.isArray(weeks[weekIndex])) {
        weeks[weekIndex] = [];
      }

      const weekDayDate = new Date(startingDate);
      weekDayDate.setDate(weekDayDate.getDate() + (dayIndex + weekIndex * 7));

      const isSameMonth = weekDayDate.getMonth() === month;

      weeks[weekIndex].push({ date: weekDayDate, isSameMonth });
    }
  }

  return weeks;
}

// NOTE: Considers week starting Monday, not Sunday
export function getDaysForWeek(
  date: Date,
): { date: Date; isSameDay: boolean; hours: { date: Date; isCurrentHour: boolean }[] }[] {
  const shortIsoDate = date.toISOString().substring(0, 10);
  const currentHour = new Date().getHours();

  const days: { date: Date; isSameDay: boolean; hours: { date: Date; isCurrentHour: boolean }[] }[] = [];

  const startingDate = new Date(date);
  startingDate.setDate(
    startingDate.getDate() - Math.abs(startingDate.getDay() === 0 ? 6 : (startingDate.getDay() - 1)),
  );

  for (let dayIndex = 0; days.length < 7; ++dayIndex) {
    const dayDate = new Date(startingDate);
    dayDate.setDate(dayDate.getDate() + dayIndex);

    const isSameDay = dayDate.toISOString().substring(0, 10) === shortIsoDate;

    days[dayIndex] = {
      date: dayDate,
      isSameDay,
      hours: [],
    };

    for (let hourIndex = 0; hourIndex < 24; ++hourIndex) {
      const dayHourDate = new Date(dayDate);
      dayHourDate.setHours(hourIndex);

      const isCurrentHour = isSameDay && hourIndex === currentHour;

      days[dayIndex].hours.push({ date: dayHourDate, isCurrentHour });
    }
  }

  return days;
}

export function getCalendarEventColor(
  calendarEvent: CalendarEvent,
  calendars: Pick<Calendar, 'id' | 'color' | 'extra'>[],
) {
  const matchingCalendar = calendars.find((calendar) => calendar.id === calendarEvent.calendar_id);
  const opaqueColor = matchingCalendar?.color || 'bg-gray-700';
  const transparentColor = opaqueColor.replace('bg-', 'border border-');

  const transparency = calendarEvent.extra.transparency === 'default'
    ? (matchingCalendar?.extra.default_transparency || 'opaque')
    : calendarEvent.extra.transparency;

  return transparency === 'opaque' ? opaqueColor : transparentColor;
}
