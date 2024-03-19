import Database, { sql } from '/lib/interfaces/database.ts';
import { Calendar, CalendarEvent } from '/lib/types.ts';
import { CALENDAR_COLOR_OPTIONS, getRandomItem } from '/lib/utils.ts';
// import { getUserById } from './user.ts';

const db = new Database();

export async function getCalendars(userId: string): Promise<Calendar[]> {
  const calendars = await db.query<Calendar>(
    sql`SELECT * FROM "bewcloud_calendars" WHERE "user_id" = $1 ORDER BY "created_at" ASC`,
    [
      userId,
    ],
  );

  return calendars;
}

export async function getCalendarEvents(userId: string, calendarIds: string[]): Promise<CalendarEvent[]> {
  const calendarEvents = await db.query<CalendarEvent>(
    sql`SELECT * FROM "bewcloud_calendar_events" WHERE "user_id" = $1 AND "calendar_id" = ANY($2) ORDER BY "start_date" ASC`,
    [
      userId,
      calendarIds,
    ],
  );

  return calendarEvents;
}

export async function getCalendarEvent(id: string, calendarId: string, userId: string): Promise<CalendarEvent> {
  const calendarEvents = await db.query<CalendarEvent>(
    sql`SELECT * FROM "bewcloud_calendar_events" WHERE "id" = $1 AND "calendar_id" = $2 AND "user_id" = $3 LIMIT 1`,
    [
      id,
      calendarId,
      userId,
    ],
  );

  return calendarEvents[0];
}

export async function getCalendar(id: string, userId: string) {
  const calendars = await db.query<Calendar>(
    sql`SELECT * FROM "bewcloud_calendars" WHERE "id" = $1 AND "user_id" = $2 LIMIT 1`,
    [
      id,
      userId,
    ],
  );

  return calendars[0];
}

export async function createCalendar(userId: string, name: string, color?: string) {
  const extra: Calendar['extra'] = {
    default_transparency: 'opaque',
  };

  const revision = crypto.randomUUID();

  const newColor = color || getRandomItem(CALENDAR_COLOR_OPTIONS);

  const newCalendar = (await db.query<Calendar>(
    sql`INSERT INTO "bewcloud_calendars" (
      "user_id",
      "revision",
      "name",
      "color",
      "is_visible",
      "extra"
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      userId,
      revision,
      name,
      newColor,
      true,
      JSON.stringify(extra),
    ],
  ))[0];

  return newCalendar;
}

export async function updateCalendar(calendar: Calendar) {
  const revision = crypto.randomUUID();

  await db.query(
    sql`UPDATE "bewcloud_calendars" SET
        "revision" = $3,
        "name" = $4,
        "color" = $5,
        "is_visible" = $6,
        "extra" = $7,
        "updated_at" = now()
      WHERE "id" = $1 AND "revision" = $2`,
    [
      calendar.id,
      calendar.revision,
      revision,
      calendar.name,
      calendar.color,
      calendar.is_visible,
      JSON.stringify(calendar.extra),
    ],
  );
}

export async function deleteCalendar(id: string, userId: string) {
  await db.query(
    sql`DELETE FROM "bewcloud_calendar_events" WHERE "calendar_id" = $1 AND "user_id" = $2`,
    [
      id,
      userId,
    ],
  );

  await db.query(
    sql`DELETE FROM "bewcloud_calendars" WHERE "id" = $1 AND "user_id" = $2`,
    [
      id,
      userId,
    ],
  );
}

// TODO: When creating, updating, or deleting events, also update the calendar's revision
