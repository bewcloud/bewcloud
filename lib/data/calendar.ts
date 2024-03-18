// import Database, { sql } from '/lib/interfaces/database.ts';
import { Calendar, CalendarEvent } from '/lib/types.ts';

// const db = new Database();

// TODO: Build this
export async function getCalendars(userId: string): Promise<Calendar[]> {
  // TODO: Remove this
  await new Promise((resolve) => setTimeout(() => resolve(true), 1));

  return [
    {
      id: 'family-1',
      user_id: userId,
      name: 'Family',
      color: 'bg-purple-500',
      is_visible: true,
      revision: 'fake-rev',
      extra: {
        default_transparency: 'opaque',
      },
      updated_at: new Date(),
      created_at: new Date(),
    },
    {
      id: 'personal-1',
      user_id: userId,
      name: 'Personal',
      color: 'bg-sky-600',
      is_visible: true,
      revision: 'fake-rev',
      extra: {
        default_transparency: 'opaque',
      },
      updated_at: new Date(),
      created_at: new Date(),
    },
    {
      id: 'house-chores-1',
      user_id: userId,
      name: 'House Chores',
      color: 'bg-red-700',
      is_visible: true,
      revision: 'fake-rev',
      extra: {
        default_transparency: 'opaque',
      },
      updated_at: new Date(),
      created_at: new Date(),
    },
  ];
}

// TODO: Build this
export async function getCalendarEvents(userId: string, calendarIds: string[]): Promise<CalendarEvent[]> {
  // TODO: Remove this
  await new Promise((resolve) => setTimeout(() => resolve(true), 1));

  const now = new Date();
  const today = now.toISOString().substring(0, 10);
  const tomorrow = new Date(new Date(now).setDate(now.getDate() + 1)).toISOString().substring(0, 10);
  const twoDaysFromNow = new Date(new Date(now).setDate(now.getDate() + 2)).toISOString().substring(0, 10);

  const calendarEvents = [
    {
      id: 'event-1',
      user_id: userId,
      calendar_id: 'family-1',
      revision: 'fake-rev',
      title: 'Dentist',
      start_date: new Date(`${today}T14:00:00.000Z`),
      end_date: new Date(`${today}T15:00:00.000Z`),
      is_all_day: false,
      status: 'scheduled',
      extra: {
        organizer_email: 'user@example.com',
        transparency: 'default',
      },
      updated_at: new Date(),
      created_at: new Date(),
    },
    {
      id: 'event-2',
      user_id: userId,
      calendar_id: 'family-1',
      revision: 'fake-rev',
      title: 'Dermatologist',
      start_date: new Date(`${today}T16:30:00.000Z`),
      end_date: new Date(`${today}T17:30:00.000Z`),
      is_all_day: false,
      status: 'scheduled',
      extra: {
        organizer_email: 'user@example.com',
        transparency: 'default',
      },
      updated_at: new Date(),
      created_at: new Date(),
    },
    {
      id: 'event-3',
      user_id: userId,
      calendar_id: 'house-chores-1',
      revision: 'fake-rev',
      title: 'Vacuum',
      start_date: new Date(`${tomorrow}T15:00:00.000Z`),
      end_date: new Date(`${tomorrow}T16:00:00.000Z`),
      is_all_day: false,
      status: 'scheduled',
      extra: {
        organizer_email: 'user@example.com',
        transparency: 'default',
      },
      updated_at: new Date(),
      created_at: new Date(),
    },
    {
      id: 'event-4',
      user_id: userId,
      calendar_id: 'personal-1',
      revision: 'fake-rev',
      title: 'Schedule server updates',
      start_date: new Date(`${twoDaysFromNow}T09:00:00.000Z`),
      end_date: new Date(`${twoDaysFromNow}T21:00:00.000Z`),
      is_all_day: true,
      status: 'scheduled',
      extra: {
        organizer_email: 'user@example.com',
        transparency: 'default',
      },
      updated_at: new Date(),
      created_at: new Date(),
    },
  ] as const;

  return calendarEvents.filter((calendarEvent) => calendarIds.includes(calendarEvent.calendar_id));
}

// TODO: Build this
export async function getCalendarEvent(id: string, calendarId: string, userId: string): Promise<CalendarEvent> {
  // TODO: Build this
  // const calendarEvents = await db.query<CalendarEvent>(
  //   sql`SELECT * FROM "bewcloud_calendar_events" WHERE "id" = $1 AND "calendar_id" = $2 AND "user_id" = $3 LIMIT 1`,
  //   [
  //     id,
  //     calendarId,
  //     userId,
  //   ],
  // );

  // return calendarEvents[0];
  const calendarEvents = await getCalendarEvents(userId, [calendarId]);

  return calendarEvents.find((calendarEvent) => calendarEvent.id === id)!;
}

export async function getCalendar(id: string, userId: string) {
  // TODO: Build this
  // const calendars = await db.query<Calendar>(
  //   sql`SELECT * FROM "bewcloud_calendars" WHERE "id" = $1 AND "user_id" = $2 LIMIT 1`,
  //   [
  //     id,
  //     userId,
  //   ],
  // );

  // return calendars[0];

  const calendars = await getCalendars(userId);

  return calendars.find((calendar) => calendar.id === id)!;
}

export async function createCalendar(userId: string, name: string, color?: string) {
  const extra: Calendar['extra'] = {
    default_transparency: 'opaque',
  };

  const revision = crypto.randomUUID();

  // TODO: Build this
  // const newCalendar = (await db.query<Calendar>(
  //   sql`INSERT INTO "bewcloud_calendars" (
  //     "user_id",
  //     "revision",
  //     "name",
  //     "color",
  //     "extra"
  //   ) VALUES ($1, $2, $3, $4, $5)
  //   RETURNING *`,
  //   [
  //     userId,
  //     revision,
  //     name,
  //     color,
  //     JSON.stringify(extra),
  //   ],
  // ))[0];

  // TODO: Generate new, non-existing color
  const newColor = color || 'bg-green-600';

  const calendars = await getCalendars(userId);
  const newCalendar = { ...calendars[0], id: crypto.randomUUID(), revision, extra, name, color: newColor };

  return newCalendar;
}

export async function updateCalendar(calendar: Calendar) {
  const revision = crypto.randomUUID();

  // TODO: Build this
  // await db.query(
  //   sql`UPDATE "bewcloud_calendars" SET
  //       "revision" = $3,
  //       "name" = $4,
  //       "color" = $5,
  //       "extra" = $6,
  //       "updated_at" = now()
  //     WHERE "id" = $1 AND "revision" = $2`,
  //   [
  //     calendar.id,
  //     calendar.revision,
  //     revision,
  //     calendar.name,
  //     calendar.color,
  //     JSON.stringify(calendar.extra),
  //   ],
  // );

  calendar.revision = revision;

  // TODO: Remove this
  await new Promise((resolve) => setTimeout(() => resolve(true), 1));
}

export async function deleteCalendar(_id: string, _userId: string) {
  // TODO: Build this
  // await db.query(
  //   sql`DELETE FROM "bewcloud_calendars" WHERE "id" = $1 AND "user_id" = $2`,
  //   [
  //     id,
  //     userId,
  //   ],
  // );

  // TODO: Remove this
  await new Promise((resolve) => setTimeout(() => resolve(true), 1));
}

// TODO: When creating, updating, or deleting events, also update the calendar's revision
