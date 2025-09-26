import { createDAVClient } from 'tsdav';

import { AppConfig } from '/lib/config.ts';
import { getColorAsHex, parseVCalendar } from '/lib/utils/calendar.ts';
import { concurrentPromises } from '../utils/misc.ts';
import { UserModel } from '/lib/models/user.ts';

interface DAVObject extends Record<string, any> {
  data?: string;
  displayName?: string;
  ctag?: string;
  url: string;
  uid?: string;
}

export interface Calendar extends DAVObject {
  calendarColor?: string;
  isVisible: boolean;
}

export interface CalendarEvent extends DAVObject {
  calendarId: string;
  startDate: Date;
  endDate: Date;
  title: string;
  isAllDay: boolean;
  organizerEmail: string;
  attendees?: CalendarEventAttendee[];
  reminders?: CalendarEventReminder[];
  transparency: 'opaque' | 'transparent';
  description?: string;
  location?: string;
  eventUrl?: string;
  sequence?: number;
  isRecurring?: boolean;
  recurringRrule?: string;
  recurrenceId?: string;
  recurrenceMasterUid?: string;
}

export interface CalendarEventAttendee {
  email: string;
  status: 'accepted' | 'rejected' | 'invited';
  name?: string;
}

export interface CalendarEventReminder {
  uid?: string;
  startDate: string;
  type: 'email' | 'sound' | 'display';
  acknowledgedAt?: string;
  description?: string;
}

const calendarConfig = await AppConfig.getCalendarConfig();

async function getClient(userId: string) {
  const client = await createDAVClient({
    serverUrl: calendarConfig.calDavUrl,
    credentials: {},
    authMethod: 'Custom',
    // deno-lint-ignore require-await
    authFunction: async () => {
      return {
        'X-Remote-User': userId,
      };
    },
    fetchOptions: {
      timeout: 15_000,
    },
    defaultAccountType: 'caldav',
    rootUrl: `${calendarConfig.calDavUrl}/`,
    principalUrl: `${calendarConfig.calDavUrl}/${userId}/`,
    homeUrl: `${calendarConfig.calDavUrl}/${userId}/`,
  });

  return client;
}

export class CalendarModel {
  static async list(
    userId: string,
  ): Promise<Calendar[]> {
    const client = await getClient(userId);

    const calendarUrl = `${calendarConfig.calDavUrl}/${userId}/`;

    const davCalendars: DAVObject[] = await client.fetchCalendars({
      calendar: {
        url: calendarUrl,
      },
    });

    const user = await UserModel.getById(userId);

    const calendars: Calendar[] = davCalendars.map((davCalendar) => {
      const uid = davCalendar.url.split('/').filter(Boolean).pop()!;

      return {
        ...davCalendar,
        displayName: decodeURIComponent(davCalendar.displayName || '(empty)'),
        calendarColor: decodeURIComponent(
          typeof davCalendar.calendarColor === 'string' ? davCalendar.calendarColor : getColorAsHex('bg-gray-700'),
        ),
        isVisible: !user.extra.hidden_calendar_ids?.includes(uid),
        uid,
      };
    });

    return calendars;
  }

  static async get(
    userId: string,
    calendarId: string,
  ): Promise<Calendar | undefined> {
    const calendars = await this.list(userId);

    return calendars.find((calendar) => calendar.uid === calendarId);
  }

  static async create(
    userId: string,
    name: string,
    color: string,
  ): Promise<void> {
    const calendarId = crypto.randomUUID();
    const calendarUrl = `${calendarConfig.calDavUrl}/${userId}/${calendarId}/`;

    const client = await getClient(userId);

    await client.makeCalendar({
      url: calendarUrl,
      props: {
        displayname: name,
      },
    });

    // Cannot properly set color with makeCalendar, so we quickly update it instead
    await this.update(userId, calendarUrl, name, color);
  }

  static async update(
    userId: string,
    calendarUrl: string,
    displayName: string,
    color?: string,
  ): Promise<void> {
    // Make "manual" request (https://www.rfc-editor.org/rfc/rfc4791.html#page-20) because tsdav doesn't have PROPPATCH
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<d:proppatch xmlns:d="DAV:" xmlns:a="http://apple.com/ns/ical/">
  <d:set>
    <d:prop>
      <d:displayname>${encodeURIComponent(displayName)}</d:displayname>
      ${color ? `<a:calendar-color>${encodeURIComponent(color)}</a:calendar-color>` : ''}
    </d:prop>
  </d:set>
</d:proppatch>`;

    await fetch(calendarUrl, {
      method: 'PROPPATCH',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Remote-User': userId,
      },
      body: xmlBody,
    });
  }

  static async delete(
    userId: string,
    calendarId: string,
  ): Promise<void> {
    const calendarUrl = `${calendarConfig.calDavUrl}/${userId}/${calendarId}/`;

    const client = await getClient(userId);

    await client.deleteObject({
      url: calendarUrl,
    });
  }
}

export class CalendarEventModel {
  private static async fetchByCalendarId(
    userId: string,
    calendarId: string,
    dateRange?: { start: Date; end: Date },
  ): Promise<CalendarEvent[]> {
    const client = await getClient(userId);

    const fetchOptions: { calendar: { url: string }; timeRange?: { start: string; end: string }; expand?: boolean } = {
      calendar: {
        url: `${calendarConfig.calDavUrl}/${userId}/${calendarId}/`,
      },
    };

    if (dateRange) {
      fetchOptions.timeRange = {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      };
      fetchOptions.expand = true;
    }

    const davCalendarEvents: DAVObject[] = await client.fetchCalendarObjects(fetchOptions);

    const calendarEvents: CalendarEvent[] = [];

    for (const davCalendarEvent of davCalendarEvents) {
      let uid = davCalendarEvent.url.split('/').filter(Boolean).pop()!;

      const parsedEvents = parseVCalendar(davCalendarEvent.data || '');

      for (const parsedEvent of parsedEvents) {
        if (parsedEvent.uid) {
          uid = parsedEvent.uid;
        }

        calendarEvents.push({
          ...davCalendarEvent,
          ...parsedEvent,
          uid,
          calendarId,
        });
      }
    }

    return calendarEvents;
  }

  static async list(
    userId: string,
    calendarIds: string[],
    dateRange?: { start: Date; end: Date },
  ): Promise<CalendarEvent[]> {
    const allCalendarEvents: CalendarEvent[] = [];

    await concurrentPromises(
      calendarIds.map((calendarId) => async () => {
        const calendarEvents = await this.fetchByCalendarId(userId, calendarId, dateRange);

        allCalendarEvents.push(...calendarEvents);

        return calendarEvents;
      }),
      5,
    );

    return allCalendarEvents;
  }

  static async get(
    userId: string,
    calendarId: string,
    eventId: string,
  ): Promise<CalendarEvent | undefined> {
    const client = await getClient(userId);

    const davCalendarEvents: DAVObject[] = await client.fetchCalendarObjects({
      calendar: {
        url: `${calendarConfig.calDavUrl}/${userId}/${calendarId}/`,
      },
      objectUrls: [`${calendarConfig.calDavUrl}/${userId}/${calendarId}/${eventId}.ics`],
    });

    if (davCalendarEvents.length === 0) {
      return undefined;
    }

    const davCalendarEvent = davCalendarEvents[0];

    const calendarEvent: CalendarEvent = {
      ...davCalendarEvent,
      ...parseVCalendar(davCalendarEvent.data || '')[0],
      uid: eventId,
      calendarId,
    };

    return calendarEvent;
  }

  static async create(
    userId: string,
    calendarId: string,
    eventId: string,
    vCalendar: string,
  ): Promise<void> {
    const client = await getClient(userId);

    const calendarUrl = `${calendarConfig.calDavUrl}/${userId}/${calendarId}/`;

    await client.createCalendarObject({
      calendar: {
        url: calendarUrl,
      },
      iCalString: vCalendar,
      filename: `${eventId}.ics`,
    });
  }

  static async update(
    userId: string,
    eventUrl: string,
    ics: string,
  ): Promise<void> {
    const client = await getClient(userId);

    await client.updateCalendarObject({
      calendarObject: {
        url: eventUrl,
        data: ics,
      },
    });
  }

  static async delete(
    userId: string,
    eventUrl: string,
  ): Promise<void> {
    const client = await getClient(userId);

    await client.deleteCalendarObject({
      calendarObject: {
        url: eventUrl,
      },
    });
  }
}
