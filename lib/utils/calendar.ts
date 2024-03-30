import { Calendar, CalendarEvent, CalendarEventAttendee, CalendarEventReminder } from '/lib/types.ts';

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

function getVCalendarAttendeeStatus(status: CalendarEventAttendee['status']) {
  if (status === 'accepted' || status === 'rejected') {
    return status.toUpperCase();
  }

  return `NEEDS-ACTION`;
}

function getAttendeeStatusFromVCalendar(
  status: 'NEEDS-ACTION' | 'ACCEPTED' | 'REJECTED',
): CalendarEventAttendee['status'] {
  if (status === 'ACCEPTED' || status === 'REJECTED') {
    return status.toLowerCase() as CalendarEventAttendee['status'];
  }

  return 'invited';
}

// TODO: Build this
export function formatCalendarEventsToVCalendar(
  calendarEvents: CalendarEvent[],
  calendars: Pick<Calendar, 'id' | 'color' | 'is_visible' | 'extra'>[],
): string {
  const vCalendarText = calendarEvents.map((calendarEvent) =>
    `BEGIN:VEVENT
DTSTAMP:${new Date(calendarEvent.created_at).toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '')}
DTSTART:${new Date(calendarEvent.start_date).toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '')}
DTEND:${new Date(calendarEvent.end_date).toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '')}
ORGANIZER;CN=:mailto:${calendarEvent.extra.organizer_email}
SUMMARY:${calendarEvent.title.replaceAll('\n', '\\n').replaceAll(',', '\\,')}
TRANSP:${getCalendarEventTransparency(calendarEvent, calendars).toUpperCase()}
${calendarEvent.extra.uid ? `UID:${calendarEvent.extra.uid}` : ''}
${calendarEvent.extra.recurring_rrule ? `RRULE:${calendarEvent.extra.recurring_rrule}` : ''}
SEQUENCE:${calendarEvent.extra.recurring_sequence || 0}
CREATED:${new Date(calendarEvent.created_at).toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '')}
LAST-MODIFIED:${
      new Date(calendarEvent.updated_at).toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '')
    }
${
      calendarEvent.extra.attendees?.map((attendee) =>
        `ATTENDEE;PARTSTAT=${getVCalendarAttendeeStatus(attendee.status)};CN=${
          attendee.name?.replaceAll('\n', '\\n').replaceAll(',', '\\,') || ''
        }:mailto:${attendee.email}`
      ).join('\n') || ''
    }
${
      calendarEvent.extra.reminders?.map((reminder) =>
        `BEGIN:VALARM
ACTION:${reminder.type.toUpperCase()}
${reminder.description ? `DESCRIPTION:${reminder.description.replaceAll('\n', '\\n').replaceAll(',', '\\,')}` : ''}
TRIGGER;VALUE=DATE-TIME:${
          new Date(reminder.start_date).toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '')
        }
${reminder.uid ? `UID:${reminder.uid}` : ''}
${
          reminder.acknowledged_at
            ? `ACKNOWLEDGED:${
              new Date(reminder.acknowledged_at).toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '')
            }`
            : ''
        }
END:VALARM`
      ).join('\n') || ''
    }
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
  // Lines that start with a space should be moved to the line above them, as it's the same field/value to parse
  const lines = text.split('\n').reduce((previousLines, currentLine) => {
    if (currentLine.startsWith(' ')) {
      previousLines[previousLines.length - 1] = `${previousLines[previousLines.length - 1]}${
        currentLine.substring(1).replaceAll('\r', '')
      }`;
    } else {
      previousLines.push(currentLine.replaceAll('\r', ''));
    }

    return previousLines;
  }, [] as string[]).map((line) => line.trim()).filter(Boolean);

  const partialCalendarEvents: Partial<CalendarEvent>[] = [];

  let partialCalendarEvent: Partial<CalendarEvent> = {};
  let partialCalendarReminder: Partial<CalendarEventReminder> = {};
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

    // Finish event
    if (line.startsWith('END:VEVENT')) {
      partialCalendarEvents.push(partialCalendarEvent);
      continue;
    }

    // Start new reminder
    if (line.startsWith('BEGIN:VALARM')) {
      partialCalendarReminder = {};
      continue;
    }

    // Finish reminder
    if (line.startsWith('END:VALARM')) {
      partialCalendarEvent.extra = {
        ...(partialCalendarEvent.extra! || {}),
        reminders: [...(partialCalendarEvent.extra?.reminders || []), partialCalendarReminder as CalendarEventReminder],
      };

      partialCalendarReminder = {};
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
      const uid = line.replace('UID:', '').trim();

      if (!uid) {
        continue;
      }

      if (Object.keys(partialCalendarReminder).length > 0) {
        partialCalendarReminder.uid = uid;

        continue;
      }

      partialCalendarEvent.extra = {
        ...(partialCalendarEvent.extra! || {}),
        uid,
      };

      continue;
    }

    if (line.startsWith('DESCRIPTION:')) {
      const description = line.replace('DESCRIPTION:', '').trim().replaceAll('\\n', '\n').replaceAll('\\,', ',');

      if (!description) {
        continue;
      }

      if (Object.keys(partialCalendarReminder).length > 0) {
        partialCalendarReminder.description = description;

        continue;
      }

      partialCalendarEvent.extra = {
        ...(partialCalendarEvent.extra! || {}),
        description,
      };

      continue;
    }

    if (line.startsWith('SUMMARY:')) {
      const title = (line.split('SUMMARY:')[1] || '').trim().replaceAll('\\n', '\n').replaceAll('\\,', ',');

      partialCalendarEvent.title = title;

      continue;
    }

    if (line.startsWith('DTSTART:') || line.startsWith('DTSTART;')) {
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

    if (line.startsWith('DTEND:') || line.startsWith('DTEND;')) {
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

    if (line.startsWith('ORGANIZER;')) {
      const organizerInfo = line.split(':');
      const organizerEmail = organizerInfo.slice(-1)[0] || '';

      if (!organizerEmail) {
        continue;
      }

      partialCalendarEvent.extra = {
        ...(partialCalendarEvent.extra! || {}),
        organizer_email: organizerEmail,
      };
    }

    if (line.startsWith('TRANSP:')) {
      const transparency = (line.split('TRANSP:')[1] || 'default')
        .toLowerCase() as CalendarEvent['extra']['transparency'];

      partialCalendarEvent.extra = {
        ...(partialCalendarEvent.extra! || {}),
        transparency,
      };

      continue;
    }

    if (line.startsWith('ATTENDEE;')) {
      const attendeeInfo = line.split(':');
      const attendeeEmail = attendeeInfo.slice(-1)[0] || '';
      const attendeeStatusInfo = line.split('PARTSTAT=')[1] || '';
      const attendeeStatus = getAttendeeStatusFromVCalendar(
        (attendeeStatusInfo.split(';')[0] || 'NEEDS-ACTION') as 'ACCEPTED' | 'REJECTED' | 'NEEDS-ACTION',
      );
      const attendeeNameInfo = line.split('CN=')[1] || '';
      const attendeeName = (attendeeNameInfo.split(';')[0] || '').trim().replaceAll('\\n', '\n').replaceAll('\\,', ',');

      if (!attendeeEmail) {
        continue;
      }

      const attendee: CalendarEventAttendee = {
        email: attendeeEmail,
        status: attendeeStatus,
      };

      if (attendeeName) {
        attendee.name = attendeeName;
      }

      partialCalendarEvent.extra = {
        ...(partialCalendarEvent.extra! || {}),
        attendees: [...(partialCalendarEvent.extra?.attendees || []), attendee],
      };
    }

    if (line.startsWith('ACTION:')) {
      const reminderType =
        (line.replace('ACTION:', '').trim().toLowerCase() || 'display') as CalendarEventReminder['type'];

      partialCalendarReminder.type = reminderType;

      continue;
    }

    if (line.startsWith('TRIGGER:') || line.startsWith('TRIGGER;')) {
      const triggerInfo = line.split(':')[1] || '';
      let triggerDate = new Date(partialCalendarEvent.start_date || new Date());

      if (line.includes('DATE-TIME')) {
        const [dateInfo, hourInfo] = triggerInfo.split('T');

        const year = dateInfo.substring(0, 4);
        const month = dateInfo.substring(4, 6);
        const day = dateInfo.substring(6, 8);

        const hours = hourInfo.substring(0, 2);
        const minutes = hourInfo.substring(2, 4);
        const seconds = hourInfo.substring(4, 6);

        triggerDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`);
      } else {
        const triggerHoursMatch = triggerInfo.match(/(\d+(?:H))/);
        const triggerMinutesMatch = triggerInfo.match(/(\d+(?:M))/);
        const triggerSecondsMatch = triggerInfo.match(/(\d+(?:S))/);

        const isNegative = triggerInfo.startsWith('-');

        if (triggerHoursMatch && triggerHoursMatch.length > 0) {
          const triggerHours = parseInt(triggerHoursMatch[0], 10);

          if (isNegative) {
            triggerDate.setHours(triggerDate.getHours() - triggerHours);
          } else {
            triggerDate.setHours(triggerHours);
          }
        }

        if (triggerMinutesMatch && triggerMinutesMatch.length > 0) {
          const triggerMinutes = parseInt(triggerMinutesMatch[0], 10);

          if (isNegative) {
            triggerDate.setMinutes(triggerDate.getMinutes() - triggerMinutes);
          } else {
            triggerDate.setMinutes(triggerMinutes);
          }
        }

        if (triggerSecondsMatch && triggerSecondsMatch.length > 0) {
          const triggerSeconds = parseInt(triggerSecondsMatch[0], 10);

          if (isNegative) {
            triggerDate.setSeconds(triggerDate.getSeconds() - triggerSeconds);
          } else {
            triggerDate.setSeconds(triggerSeconds);
          }
        }
      }

      partialCalendarReminder.start_date = triggerDate.toISOString();

      continue;
    }

    if (line.startsWith('RRULE:')) {
      const rRule = line.replace('RRULE:', '').trim();

      if (!rRule) {
        continue;
      }

      partialCalendarEvent.extra = {
        ...(partialCalendarEvent.extra! || {}),
        recurring_rrule: rRule,
        recurring_sequence: partialCalendarEvent.extra?.recurring_sequence || 0,
      };

      continue;
    }

    if (line.startsWith('SEQUENCE:')) {
      const sequence = line.replace('SEQUENCE:', '').trim();

      if (!sequence || sequence === '0') {
        continue;
      }

      partialCalendarEvent.extra = {
        ...(partialCalendarEvent.extra! || {}),
        recurring_sequence: parseInt(sequence, 10),
      };

      continue;
    }

    // TODO: Build this ( https://en.wikipedia.org/wiki/ICalendar#List_of_components,_properties,_and_parameters )
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

function getCalendarEventTransparency(
  calendarEvent: CalendarEvent,
  calendars: Pick<Calendar, 'id' | 'extra'>[],
) {
  const matchingCalendar = calendars.find((calendar) => calendar.id === calendarEvent.calendar_id);

  const transparency = calendarEvent.extra.transparency === 'default'
    ? (matchingCalendar?.extra.default_transparency || 'opaque')
    : calendarEvent.extra.transparency;

  return transparency;
}

export function getCalendarEventColor(
  calendarEvent: CalendarEvent,
  calendars: Pick<Calendar, 'id' | 'color' | 'extra'>[],
) {
  const matchingCalendar = calendars.find((calendar) => calendar.id === calendarEvent.calendar_id);
  const opaqueColor = matchingCalendar?.color || 'bg-gray-700';
  const transparentColor = opaqueColor.replace('bg-', 'border border-');

  const transparency = getCalendarEventTransparency(calendarEvent, calendars);

  return transparency === 'opaque' ? opaqueColor : transparentColor;
}

type RRuleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type RRuleWeekDay = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
type RRuleType = 'FREQ' | 'BYDAY' | 'BYMONTHDAY' | 'BYHOUR' | 'BYMINUTE' | 'COUNT' | 'INTERVAL';

const rRuleToFrequencyOrWeekDay = new Map<RRuleFrequency | RRuleWeekDay, string>([
  ['DAILY', 'day'],
  ['WEEKLY', 'week'],
  ['MONTHLY', 'month'],
  ['MO', 'Monday'],
  ['TU', 'Tuesday'],
  ['WE', 'Wednesday'],
  ['TH', 'Thursday'],
  ['FR', 'Friday'],
  ['SA', 'Saturday'],
  ['SU', 'Sunday'],
]);

// check if multiple days and format either way
function convertRRuleDaysToWords(day: string | RRuleFrequency | RRuleWeekDay): string {
  if (day.includes(',')) {
    const days = day.split(',') as (typeof day)[];
    return days.map((individualDay) => rRuleToFrequencyOrWeekDay.get(individualDay as RRuleFrequency | RRuleWeekDay))
      .join(',');
  }

  return rRuleToFrequencyOrWeekDay.get(day as RRuleFrequency | RRuleWeekDay)!;
}

// convert to ordinal number
function getOrdinalSuffix(number: number) {
  const text = ['th', 'st', 'nd', 'rd'] as const;
  const value = number % 100;
  return `${number}${(text[(value - 20) % 10] || text[value] || text[0])}`;
}

export function convertRRuleToWords(rRule: string): string {
  const rulePart = rRule.replace('RRULE:', '');

  const rulePieces = rulePart.split(';');

  const parsedRRule: Partial<Record<RRuleType, string>> = {};

  rulePieces.forEach(function (rulePiece) {
    const keyAndValue = rulePiece.split('=') as [RRuleType, string];
    const [key, value] = keyAndValue;

    parsedRRule[key] = value;
  });

  const frequency = parsedRRule.FREQ;
  const byDay = parsedRRule.BYDAY;
  const byMonthDay = parsedRRule.BYMONTHDAY;
  const byHour = parsedRRule.BYHOUR;
  const byMinute = parsedRRule.BYMINUTE;
  const count = parsedRRule.COUNT;
  const interval = parsedRRule.INTERVAL;

  // TODO: Remove this
  console.log('==== File.method');
  console.log(JSON.stringify({}, null, 2));

  const words: string[] = [];

  if (frequency === 'DAILY') {
    if (byHour) {
      if (byMinute) {
        words.push(`Every day at ${byHour}:${byMinute}`);
      } else {
        words.push(`Every day at ${byHour}:00`);
      }
    } else {
      words.push(`Every day`);
    }

    if (count) {
      if (count === '1') {
        words.push(`for 1 time`);
      } else {
        words.push(`for ${count} times`);
      }
    }

    return words.join(' ');
  }

  if (frequency === 'WEEKLY') {
    if (byDay) {
      if (interval && parseInt(interval) > 1) {
        words.push(
          `Every ${interval} ${rRuleToFrequencyOrWeekDay.get(frequency)}s on ${convertRRuleDaysToWords(byDay)}`,
        );
      } else {
        words.push(`Every ${rRuleToFrequencyOrWeekDay.get(frequency)} on ${convertRRuleDaysToWords(byDay)}`);
      }
    }

    if (byMonthDay) {
      words.push(`the ${getOrdinalSuffix(parseInt(byMonthDay, 10))}`);
    }

    if (count) {
      if (count === '1') {
        words.push(`for 1 time`);
      } else {
        words.push(`for ${count} times`);
      }
    }

    return words.join(' ');
  }

  // monthly
  if (frequency === 'MONTHLY' && byMonthDay) {
    if (interval && parseInt(interval) > 1) {
      words.push(
        `Every ${interval} ${rRuleToFrequencyOrWeekDay.get(frequency)}s on the ${
          getOrdinalSuffix(parseInt(byMonthDay, 10))
        }`,
      );
    } else {
      words.push(
        `Every ${rRuleToFrequencyOrWeekDay.get(frequency)} on the ${getOrdinalSuffix(parseInt(byMonthDay, 10))}`,
      );
    }

    if (count) {
      if (count === '1') {
        words.push(` for 1 time`);
      } else {
        words.push(` for ${count} times`);
      }
    }
    return words.join(' ');
  }

  return words.join(' ');
}
