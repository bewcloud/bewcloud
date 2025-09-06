import { Calendar, CalendarEvent, CalendarEventAttendee, CalendarEventReminder } from '/lib/models/calendar.ts';

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

const CALENDAR_COLOR_OPTIONS_HEX = [
  '#B51E1F',
  '#450A0A',
  '#BF4310',
  '#431407',
  '#B0550F',
  '#834F13',
  '#4D7D16',
  '#1A2E05',
  '#148041',
  '#066048',
  '#107873',
  '#0E7490',
  '#075985',
  '#1E3A89',
  '#423BCA',
  '#6A2BD9',
  '#6923A9',
  '#9D21B1',
  '#9C174D',
  '#BC133D',
] as const;

export function getColorAsHex(calendarColor: string) {
  const colorIndex = CALENDAR_COLOR_OPTIONS.findIndex((color) => color === calendarColor);

  return CALENDAR_COLOR_OPTIONS_HEX[colorIndex] || '#384354';
}

export function getIdFromVEvent(vEvent: string): string {
  const lines = vEvent.split('\n').map((line) => line.trim()).filter(Boolean);

  // Loop through every line and find the UID line
  for (const line of lines) {
    if (line.startsWith('UID:')) {
      const uid = line.replace('UID:', '');
      return uid.trim();
    }
  }

  return crypto.randomUUID();
}

export function splitTextIntoVEvents(text: string): string[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const vEvents: string[] = [];
  const currentVEvent: string[] = [];
  let hasFoundBeginVEvent = false;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      hasFoundBeginVEvent = true;
    }

    if (!hasFoundBeginVEvent) {
      continue;
    }

    currentVEvent.push(line);

    if (line.startsWith('END:VEVENT')) {
      vEvents.push(currentVEvent.join('\n'));
      currentVEvent.length = 0;
      hasFoundBeginVEvent = false;
    }
  }

  return vEvents;
}

export function getDateRangeForCalendarView(
  calendarStartDate: string,
  calendarView: 'day' | 'week' | 'month',
): { start: Date; end: Date } {
  const dateRange = { start: new Date(calendarStartDate), end: new Date(calendarStartDate) };

  if (calendarView === 'day') {
    dateRange.start.setUTCDate(dateRange.start.getUTCDate() - 1);
    dateRange.end.setUTCDate(dateRange.end.getUTCDate() + 1);
  } else if (calendarView === 'week') {
    dateRange.start.setUTCDate(dateRange.start.getUTCDate() - 7);
    dateRange.end.setUTCDate(dateRange.end.getUTCDate() + 7);
  } else {
    dateRange.start.setUTCDate(dateRange.start.getUTCDate() - 7);
    dateRange.end.setUTCDate(dateRange.end.getUTCDate() + 31);
  }

  return dateRange;
}

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

export function getVCalendarDate(date: Date | string) {
  return new Date(date).toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '');
}

function getSafelyEscapedTextForVCalendar(text: string) {
  return text.replaceAll('\n', '\\n').replaceAll(',', '\\,');
}

function getSafelyUnescapedTextFromVCalendar(text: string) {
  return text.replaceAll('\\n', '\n').replaceAll('\\,', ',');
}

export function generateVCalendar(
  events: CalendarEvent[],
  createdDate: Date = new Date(),
): string {
  const vCalendarText = events.map((event) => generateVEvent(event, createdDate)).join('\n');

  return `BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\n${vCalendarText}\nEND:VCALENDAR`.split('\n').map((line) =>
    line.trim()
  ).filter(
    Boolean,
  ).join('\n');
}

export function generateVEvent(calendarEvent: CalendarEvent, createdDate: Date = new Date()): string {
  const vEventText = `BEGIN:VEVENT
DTSTAMP:${getVCalendarDate(createdDate)}
${
    calendarEvent.isAllDay
      ? `DTSTART;VALUE=DATE:${getVCalendarDate(calendarEvent.startDate).substring(0, 8)}`
      : `DTSTART:${getVCalendarDate(calendarEvent.startDate)}`
  }
${
    calendarEvent.isAllDay
      ? `DTEND;VALUE=DATE:${getVCalendarDate(calendarEvent.endDate).substring(0, 8)}`
      : `DTEND:${getVCalendarDate(calendarEvent.endDate)}`
  }
ORGANIZER;CN=:mailto:${calendarEvent.organizerEmail}
SUMMARY:${getSafelyEscapedTextForVCalendar(calendarEvent.title)}
TRANSP:${calendarEvent.transparency.toUpperCase()}
UID:${calendarEvent.uid}
${calendarEvent.isRecurring && calendarEvent.recurringRrule ? `RRULE:${calendarEvent.recurringRrule}` : ''}
${calendarEvent.sequence && calendarEvent.sequence > 0 ? `SEQUENCE:${calendarEvent.sequence}` : 'SEQUENCE:0'}
CREATED:${getVCalendarDate(createdDate)}
LAST-MODIFIED:${getVCalendarDate(createdDate)}
${
    calendarEvent.description
      ? `DESCRIPTION:${getSafelyEscapedTextForVCalendar(calendarEvent.description.replaceAll('\r', ''))}`
      : ''
  }
${calendarEvent.location ? `LOCATION:${getSafelyEscapedTextForVCalendar(calendarEvent.location)}` : ''}
${calendarEvent.eventUrl ? `URL:${getSafelyEscapedTextForVCalendar(calendarEvent.eventUrl)}` : ''}
${
    calendarEvent.attendees?.map((attendee) =>
      `ATTENDEE;PARTSTAT=${getVCalendarAttendeeStatus(attendee.status)};CN=${
        getSafelyEscapedTextForVCalendar(attendee.name || '')
      }:mailto:${attendee.email}`
    ).join('\n') || ''
  }
${
    calendarEvent.reminders?.map((reminder) =>
      `BEGIN:VALARM
ACTION:${reminder.type.toUpperCase()}
${
        reminder.description
          ? `DESCRIPTION:${getSafelyEscapedTextForVCalendar(reminder.description.replaceAll('\r', ''))}`
          : ''
      }
TRIGGER;VALUE=DATE-TIME:${getVCalendarDate(reminder.startDate)}
${reminder.uid ? `UID:${reminder.uid}` : ''}
${reminder.acknowledgedAt ? `ACKNOWLEDGED:${getVCalendarDate(reminder.acknowledgedAt)}` : ''}
END:VALARM`
    ).join('\n') || ''
  }
END:VEVENT`;

  return vEventText.split('\n').map((line) => line.trim()).filter(Boolean).join('\n');
}

export function updateIcs(
  ics: string,
  event: CalendarEvent,
): string {
  const lines = ics.split('\n').map((line) => line.trim()).filter(Boolean);

  let replacedTitle = false;
  let replacedStartDate = false;
  let replacedEndDate = false;
  let replacedStatus = false;
  let replacedDescription = false;
  let replacedEventUrl = false;
  let replacedLocation = false;
  let replacedTransparency = false;
  let replacedLastModified = false;
  let hasFoundFirstEventLine = false;
  const lastModifiedDate = new Date();

  const updatedIcsLines = lines.map((line) => {
    // Skip everything until finding the first event
    if (!hasFoundFirstEventLine) {
      hasFoundFirstEventLine = line.startsWith('BEGIN:VEVENT');
      return line;
    }

    if (line.startsWith('SUMMARY:') && event.title && !replacedTitle) {
      replacedTitle = true;
      return `SUMMARY:${getSafelyEscapedTextForVCalendar(event.title)}`;
    }

    if ((line.startsWith('DTSTART:') || line.startsWith('DTSTART;')) && event.startDate && !replacedStartDate) {
      replacedStartDate = true;
      if (event.isAllDay) {
        return `DTSTART;VALUE=DATE:${getVCalendarDate(event.startDate).substring(0, 8)}`;
      }
      return `DTSTART:${getVCalendarDate(event.startDate)}`;
    }

    if ((line.startsWith('DTEND:') || line.startsWith('DTEND;')) && event.endDate && !replacedEndDate) {
      replacedEndDate = true;
      if (event.isAllDay) {
        return `DTEND;VALUE=DATE:${getVCalendarDate(event.endDate).substring(0, 8)}`;
      }
      return `DTEND:${getVCalendarDate(event.endDate)}`;
    }

    if (line.startsWith('STATUS:') && event.status && !replacedStatus) {
      replacedStatus = true;
      return `STATUS:${getSafelyEscapedTextForVCalendar(event.status)}`;
    }

    if (line.startsWith('DESCRIPTION:') && event.description && !replacedDescription) {
      replacedDescription = true;
      return `DESCRIPTION:${getSafelyEscapedTextForVCalendar(event.description.replaceAll('\r', ''))}`;
    }

    if (line.startsWith('URL:') && event.eventUrl && !replacedEventUrl) {
      replacedEventUrl = true;
      return `URL:${getSafelyEscapedTextForVCalendar(event.eventUrl)}`;
    }

    if (line.startsWith('LOCATION:') && event.location && !replacedLocation) {
      replacedLocation = true;
      return `LOCATION:${getSafelyEscapedTextForVCalendar(event.location)}`;
    }

    if (line.startsWith('TRANSP:') && event.transparency && !replacedTransparency) {
      replacedTransparency = true;
      return `TRANSP:${getSafelyEscapedTextForVCalendar(event.transparency.toUpperCase())}`;
    }

    if (line.startsWith('LAST-MODIFIED:') && !replacedLastModified) {
      replacedLastModified = true;
      return `LAST-MODIFIED:${getVCalendarDate(lastModifiedDate)}`;
    }

    return line;
  });

  // Find last line with END:VEVENT, extract it and what's after it
  const endLineIndex = updatedIcsLines.findIndex((line) => line.startsWith('END:VEVENT'));
  const endLines = updatedIcsLines.splice(endLineIndex, updatedIcsLines.length - endLineIndex);

  if (!replacedDescription && event.description) {
    updatedIcsLines.push(`DESCRIPTION:${getSafelyEscapedTextForVCalendar(event.description)}`);
  }

  if (!replacedEventUrl && event.eventUrl) {
    updatedIcsLines.push(`URL:${getSafelyEscapedTextForVCalendar(event.eventUrl)}`);
  }

  if (!replacedLocation && event.location) {
    updatedIcsLines.push(`LOCATION:${getSafelyEscapedTextForVCalendar(event.location)}`);
  }

  // Put the final lines back
  updatedIcsLines.push(...endLines);

  const updatedIcs = updatedIcsLines.map((line) => line.trim()).filter(Boolean).join('\n');

  return updatedIcs;
}

export function parseIcsDate(date: string): Date {
  const [dateInfo, hourInfo] = date.split('T');

  const year = dateInfo.substring(0, 4);
  const month = dateInfo.substring(4, 6);
  const day = dateInfo.substring(6, 8);

  const hours = hourInfo.substring(0, 2);
  const minutes = hourInfo.substring(2, 4);
  const seconds = hourInfo.substring(4, 6);

  return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`);
}

type VCalendarVersion = '1.0' | '2.0';

export function parseVCalendar(text: string): CalendarEvent[] {
  // Lines that start with a space should be moved to the line above them, as it's the same field/value to parse
  const lines = text.split('\n').reduce((previousLines, currentLine) => {
    if (currentLine.startsWith(' ')) {
      previousLines[previousLines.length - 1] = `${previousLines[previousLines.length - 1]} ${
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
  const partialRecurringMasterEvent: Pick<CalendarEvent, 'uid'> = {};

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
      partialCalendarEvent.reminders = [
        ...(partialCalendarEvent?.reminders || []),
        partialCalendarReminder as CalendarEventReminder,
      ];

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

      partialCalendarEvent.uid = uid;

      continue;
    }

    if (line.startsWith('RECURRENCE-ID:')) {
      const recurrenceId = line.replace('RECURRENCE-ID:', '').trim();

      if (!recurrenceId) {
        continue;
      }

      // If we haven't found the master event yet, use the current event as the master (the UID from the ICS will be the master's, and the same for all instances)
      if (Object.keys(partialRecurringMasterEvent).length === 0) {
        partialRecurringMasterEvent.uid = partialCalendarEvent.uid;
      }

      partialCalendarEvent.recurrenceMasterUid = partialCalendarEvent.uid || partialRecurringMasterEvent.uid;
      partialCalendarEvent.uid = `${partialCalendarEvent.recurrenceMasterUid}:${recurrenceId}`;
      partialCalendarEvent.isRecurring = true;
      partialCalendarEvent.recurrenceId = recurrenceId;

      continue;
    }

    if (line.startsWith('DESCRIPTION:')) {
      const description = getSafelyUnescapedTextFromVCalendar(line.replace('DESCRIPTION:', '').trim());

      if (!description) {
        continue;
      }

      if (Object.keys(partialCalendarReminder).length > 0) {
        partialCalendarReminder.description = description;

        continue;
      }

      partialCalendarEvent.description = description;

      continue;
    }

    if (line.startsWith('SUMMARY:')) {
      const title = getSafelyUnescapedTextFromVCalendar((line.split('SUMMARY:')[1] || '').trim());

      if (!title) {
        continue;
      }

      partialCalendarEvent.title = title;

      continue;
    }

    if (line.startsWith('URL:')) {
      const eventUrl = getSafelyUnescapedTextFromVCalendar((line.split('URL:')[1] || '').trim());

      if (!eventUrl) {
        continue;
      }

      partialCalendarEvent.eventUrl = eventUrl;

      continue;
    }

    if (line.startsWith('LOCATION:')) {
      const location = getSafelyUnescapedTextFromVCalendar((line.split('LOCATION:')[1] || '').trim());

      if (!location) {
        continue;
      }

      partialCalendarEvent.location = location;

      continue;
    }

    if (line.startsWith('DTSTART:') || line.startsWith('DTSTART;')) {
      const startDateInfo = line.split(':')[1] || '';
      const startDate = parseIcsDate(startDateInfo);

      partialCalendarEvent.startDate = startDate;

      continue;
    }

    if (line.startsWith('DTEND:') || line.startsWith('DTEND;')) {
      const endDateInfo = line.split(':')[1] || '';
      const endDate = parseIcsDate(endDateInfo);

      partialCalendarEvent.endDate = endDate;

      continue;
    }

    if (line.startsWith('ORGANIZER;')) {
      const organizerInfo = line.split(':');
      const organizerEmail = organizerInfo.slice(-1)[0] || '';

      if (!organizerEmail) {
        continue;
      }

      partialCalendarEvent.organizerEmail = organizerEmail;
    }

    if (line.startsWith('TRANSP:')) {
      const transparency = (line.split('TRANSP:')[1] || 'opaque')
        .toLowerCase() as CalendarEvent['transparency'];

      partialCalendarEvent.transparency = transparency;

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
      const attendeeName = getSafelyUnescapedTextFromVCalendar((attendeeNameInfo.split(';')[0] || '').trim());

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

      partialCalendarEvent.attendees = [...(partialCalendarEvent?.attendees || []), attendee];
    }

    if (line.startsWith('ACTION:')) {
      const reminderType =
        (line.replace('ACTION:', '').trim().toLowerCase() || 'display') as CalendarEventReminder['type'];

      partialCalendarReminder.type = reminderType;

      continue;
    }

    if (line.startsWith('TRIGGER:') || line.startsWith('TRIGGER;')) {
      const triggerInfo = line.split(':')[1] || '';
      let triggerDate = new Date(partialCalendarEvent.startDate || new Date());

      if (line.includes('DATE-TIME')) {
        triggerDate = parseIcsDate(triggerInfo);
      } else {
        const triggerHoursMatch = triggerInfo.match(/(\d+(?:H))/);
        const triggerMinutesMatch = triggerInfo.match(/(\d+(?:M))/);
        const triggerSecondsMatch = triggerInfo.match(/(\d+(?:S))/);

        const isNegative = triggerInfo.startsWith('-');

        if (triggerHoursMatch && triggerHoursMatch.length > 0) {
          const triggerHours = parseInt(triggerHoursMatch[0], 10);

          if (isNegative) {
            triggerDate.setUTCHours(triggerDate.getUTCHours() - triggerHours);
          } else {
            triggerDate.setUTCHours(triggerHours);
          }
        }

        if (triggerMinutesMatch && triggerMinutesMatch.length > 0) {
          const triggerMinutes = parseInt(triggerMinutesMatch[0], 10);

          if (isNegative) {
            triggerDate.setUTCMinutes(triggerDate.getUTCMinutes() - triggerMinutes);
          } else {
            triggerDate.setUTCMinutes(triggerMinutes);
          }
        }

        if (triggerSecondsMatch && triggerSecondsMatch.length > 0) {
          const triggerSeconds = parseInt(triggerSecondsMatch[0], 10);

          if (isNegative) {
            triggerDate.setUTCSeconds(triggerDate.getUTCSeconds() - triggerSeconds);
          } else {
            triggerDate.setUTCSeconds(triggerSeconds);
          }
        }
      }

      partialCalendarReminder.startDate = triggerDate.toISOString();

      continue;
    }

    if (line.startsWith('RRULE:')) {
      const rRule = line.replace('RRULE:', '').trim();

      if (!rRule) {
        continue;
      }

      partialCalendarEvent.isRecurring = true;
      partialCalendarEvent.recurringRrule = rRule;
      partialCalendarEvent.sequence = partialCalendarEvent.sequence || 0;

      continue;
    }

    if (line.startsWith('SEQUENCE:')) {
      const sequence = line.replace('SEQUENCE:', '').trim();

      if (!sequence || sequence === '0') {
        continue;
      }

      partialCalendarEvent.sequence = parseInt(sequence, 10);

      continue;
    }
  }

  return partialCalendarEvents as CalendarEvent[];
}

// NOTE: Considers weeks starting Monday, not Sunday
export function getWeeksForMonth(date: Date): { date: Date; isSameMonth: boolean }[][] {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const daysToShow = firstOfMonth.getUTCDay() + (firstOfMonth.getUTCDay() === 0 ? 6 : -1) + lastOfMonth.getUTCDate();

  const weekCount = Math.ceil(daysToShow / 7);

  const weeks: { date: Date; isSameMonth: boolean }[][] = [];

  const startingDate = new Date(firstOfMonth);
  startingDate.setUTCDate(
    startingDate.getUTCDate() - Math.abs(firstOfMonth.getUTCDay() === 0 ? 6 : (firstOfMonth.getUTCDay() - 1)),
  );

  for (let weekIndex = 0; weeks.length < weekCount; ++weekIndex) {
    for (let dayIndex = 0; dayIndex < 7; ++dayIndex) {
      if (!Array.isArray(weeks[weekIndex])) {
        weeks[weekIndex] = [];
      }

      const weekDayDate = new Date(startingDate);
      weekDayDate.setUTCDate(weekDayDate.getUTCDate() + (dayIndex + weekIndex * 7));

      const isSameMonth = weekDayDate.getUTCMonth() === month;

      weeks[weekIndex].push({ date: weekDayDate, isSameMonth });
    }
  }

  return weeks;
}

// NOTE: Considers week starting Monday, not Sunday
export function getDaysForWeek(
  date: Date,
): { date: Date; isSameDay: boolean; hours: { date: Date; isCurrentHour: boolean }[] }[] {
  const shortIsoDate = new Date().toISOString().substring(0, 10);
  const currentHour = new Date().getUTCHours();

  const days: { date: Date; isSameDay: boolean; hours: { date: Date; isCurrentHour: boolean }[] }[] = [];

  const startingDate = new Date(date);
  startingDate.setUTCDate(
    startingDate.getUTCDate() - Math.abs(startingDate.getUTCDay() === 0 ? 6 : (startingDate.getUTCDay() - 1)),
  );

  for (let dayIndex = 0; days.length < 7; ++dayIndex) {
    const dayDate = new Date(startingDate);
    dayDate.setUTCDate(dayDate.getUTCDate() + dayIndex);

    const isSameDay = dayDate.toISOString().substring(0, 10) === shortIsoDate;

    days[dayIndex] = {
      date: dayDate,
      isSameDay,
      hours: [],
    };

    for (let hourIndex = 0; hourIndex < 24; ++hourIndex) {
      const dayHourDate = new Date(dayDate);
      dayHourDate.setUTCHours(hourIndex);

      const isCurrentHour = isSameDay && hourIndex === currentHour;

      days[dayIndex].hours.push({ date: dayHourDate, isCurrentHour });
    }
  }

  return days;
}

export function getCalendarEventStyle(
  calendarEvent: CalendarEvent,
  calendars: Calendar[],
): { backgroundColor?: string; border?: string } {
  const matchingCalendar = calendars.find((calendar) => calendar.uid === calendarEvent.calendarId);
  const hexColor = matchingCalendar?.calendarColor || getColorAsHex('bg-gray-700');

  return calendarEvent.transparency === 'opaque'
    ? {
      backgroundColor: hexColor,
    }
    : {
      border: `1px solid ${hexColor}`,
    };
}

type RRuleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type RRuleWeekDay = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
type RRuleType = 'FREQ' | 'BYDAY' | 'BYMONTHDAY' | 'BYHOUR' | 'BYMINUTE' | 'COUNT' | 'INTERVAL' | 'UNTIL';

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

function convertRRuleDaysToWords(day: string | RRuleFrequency | RRuleWeekDay): string {
  if (day.includes(',')) {
    const days = day.split(',') as (typeof day)[];
    return days.map((individualDay) => rRuleToFrequencyOrWeekDay.get(individualDay as RRuleFrequency | RRuleWeekDay))
      .join(', ');
  }

  return rRuleToFrequencyOrWeekDay.get(day as RRuleFrequency | RRuleWeekDay)!;
}

function getOrdinalSuffix(number: number) {
  const text = ['th', 'st', 'nd', 'rd'] as const;
  const value = number % 100;
  return `${number}${(text[(value - 20) % 10] || text[value] || text[0])}`;
}

export function convertRRuleToWords(
  rRule: string,
  { capitalizeSentence = true }: { capitalizeSentence?: boolean } = {},
): string {
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
  const until = parsedRRule.UNTIL;

  const words: string[] = [];

  if (frequency === 'DAILY') {
    if (byHour) {
      if (byMinute) {
        words.push(`${capitalizeSentence ? 'Every' : 'every'} day at ${byHour}:${byMinute}`);
      } else {
        words.push(`${capitalizeSentence ? 'Every' : 'every'} day at ${byHour}:00`);
      }
    } else {
      words.push(`${capitalizeSentence ? 'Every' : 'every'} day`);
    }

    if (count) {
      if (count === '1') {
        words.push(`for 1 time`);
      } else {
        words.push(`for ${count} times`);
      }
    }

    if (until) {
      const untilDate = parseIcsDate(until);

      words.push(`until ${untilDate.toISOString().substring(0, 10)}`);
    }

    return words.join(' ');
  }

  if (frequency === 'WEEKLY') {
    if (byDay) {
      if (interval && parseInt(interval, 10) > 1) {
        words.push(
          `${capitalizeSentence ? 'Every' : 'every'} ${interval} ${rRuleToFrequencyOrWeekDay.get(frequency)}s on ${
            convertRRuleDaysToWords(byDay)
          }`,
        );
      } else {
        words.push(
          `${capitalizeSentence ? 'Every' : 'every'} ${rRuleToFrequencyOrWeekDay.get(frequency)} on ${
            convertRRuleDaysToWords(byDay)
          }`,
        );
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

    if (until) {
      const untilDate = parseIcsDate(until);

      words.push(`until ${untilDate.toISOString().substring(0, 10)}`);
    }

    return words.join(' ');
  }

  // monthly
  if (frequency === 'MONTHLY' && byMonthDay) {
    if (interval && parseInt(interval, 10) > 1) {
      words.push(
        `${capitalizeSentence ? 'Every' : 'every'} ${interval} ${rRuleToFrequencyOrWeekDay.get(frequency)}s on the ${
          getOrdinalSuffix(parseInt(byMonthDay, 10))
        }`,
      );
    } else {
      words.push(
        `${capitalizeSentence ? 'Every' : 'every'} ${rRuleToFrequencyOrWeekDay.get(frequency)} on the ${
          getOrdinalSuffix(parseInt(byMonthDay, 10))
        }`,
      );
    }

    if (count) {
      if (count === '1') {
        words.push(` for 1 time`);
      } else {
        words.push(` for ${count} times`);
      }
    }

    if (until) {
      const untilDate = parseIcsDate(until);

      words.push(`until ${untilDate.toISOString().substring(0, 10)}`);
    }

    return words.join(' ');
  }

  return words.join(' ');
}

type ParsedTimeZone = {
  id: string;
  label: string;
  utcOffset: number;
};

function offsetStringToNumeric(offsetString: string): number {
  const sign = offsetString.startsWith('GMT-') ? -1 : 1;
  const [hours, minutes] = offsetString.slice(4).split(':').map(Number);
  return sign * (hours * 60 + minutes) || 0;
}

export function getTimeZones(): ParsedTimeZone[] {
  const supportedTimeZones = Intl.supportedValuesOf('timeZone');

  const timezones: ParsedTimeZone[] = [{
    id: 'UTC',
    label: 'UTC',
    utcOffset: 0,
  }];

  const now = new Date();

  for (const tz of supportedTimeZones) {
    // Some browsers return UTC as a timezone, so we can skip it to avoid duplicates
    if (timezones.find((timezone) => timezone.id === tz)) {
      continue;
    }

    const offsetFormat = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      timeZoneName: 'longOffset',
    });

    const formattedOffset = offsetFormat.format(now);
    const [, offsetString] = formattedOffset.split(', ');

    const offsetNumeric = offsetStringToNumeric(offsetString);

    timezones.push({
      id: tz,
      label: `${tz} (${offsetString})`,
      utcOffset: offsetNumeric,
    });
  }

  return timezones;
}
