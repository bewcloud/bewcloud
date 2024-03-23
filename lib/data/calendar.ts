import Database, { sql } from '/lib/interfaces/database.ts';
import { Calendar, CalendarEvent } from '/lib/types.ts';
import { CALENDAR_COLOR_OPTIONS, getRandomItem } from '/lib/utils.ts';
import { getUserById } from './user.ts';

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

export async function getCalendarEvents(
  userId: string,
  calendarIds: string[],
  dateRange?: { start: Date; end: Date },
): Promise<CalendarEvent[]> {
  if (!dateRange) {
    const calendarEvents = await db.query<CalendarEvent>(
      sql`SELECT * FROM "bewcloud_calendar_events" WHERE "user_id" = $1 AND "calendar_id" = ANY($2) ORDER BY "start_date" ASC`,
      [
        userId,
        calendarIds,
      ],
    );

    return calendarEvents;
  } else {
    const calendarEvents = await db.query<CalendarEvent>(
      sql`SELECT * FROM "bewcloud_calendar_events" WHERE "user_id" = $1 AND "calendar_id" = ANY($2) AND (("start_date" >= $3 OR "end_date" <= $4) OR ("start_date" < $3 AND "end_date" > $4)) ORDER BY "start_date" ASC`,
      [
        userId,
        calendarIds,
        dateRange.start,
        dateRange.end,
      ],
    );

    return calendarEvents;
  }
}

export async function getCalendarEvent(id: string, userId: string): Promise<CalendarEvent> {
  const calendarEvents = await db.query<CalendarEvent>(
    sql`SELECT * FROM "bewcloud_calendar_events" WHERE "id" = $1 AND "user_id" = $2 LIMIT 1`,
    [
      id,
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

async function updateCalendarRevision(calendar: Calendar) {
  const revision = crypto.randomUUID();

  await db.query(
    sql`UPDATE "bewcloud_calendars" SET
        "revision" = $3,
        "updated_at" = now()
      WHERE "id" = $1 AND "revision" = $2`,
    [
      calendar.id,
      calendar.revision,
      revision,
    ],
  );
}

export async function createCalendarEvent(
  userId: string,
  calendarId: string,
  title: string,
  startDate: Date,
  endDate: Date,
  isAllDay = false,
) {
  const user = await getUserById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  const calendar = await getCalendar(calendarId, userId);

  if (!calendar) {
    throw new Error('Calendar not found');
  }

  const extra: CalendarEvent['extra'] = {
    organizer_email: user.email,
    transparency: 'default',
  };

  const revision = crypto.randomUUID();

  const status: CalendarEvent['status'] = 'scheduled';

  const newCalendar = (await db.query<Calendar>(
    sql`INSERT INTO "bewcloud_calendar_events" (
      "user_id",
      "calendar_id",
      "revision",
      "title",
      "start_date",
      "end_date",
      "is_all_day",
      "status",
      "extra"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      userId,
      calendarId,
      revision,
      title,
      startDate,
      endDate,
      isAllDay,
      status,
      JSON.stringify(extra),
    ],
  ))[0];

  await updateCalendarRevision(calendar);

  return newCalendar;
}

export async function updateCalendarEvent(calendarEvent: CalendarEvent, oldCalendarId?: string) {
  const revision = crypto.randomUUID();

  const user = await getUserById(calendarEvent.user_id);

  if (!user) {
    throw new Error('User not found');
  }

  const calendar = await getCalendar(calendarEvent.calendar_id, user.id);

  if (!calendar) {
    throw new Error('Calendar not found');
  }

  const oldCalendar = oldCalendarId ? await getCalendar(oldCalendarId, user.id) : null;

  await db.query(
    sql`UPDATE "bewcloud_calendar_events" SET
        "revision" = $3,
        "calendar_id" = $4,
        "title" = $5,
        "start_date" = $6,
        "end_date" = $7,
        "is_all_day" = $8,
        "status" = $9,
        "extra" = $10,
        "updated_at" = now()
      WHERE "id" = $1 AND "revision" = $2`,
    [
      calendarEvent.id,
      calendarEvent.revision,
      revision,
      calendarEvent.calendar_id,
      calendarEvent.title,
      calendarEvent.start_date,
      calendarEvent.end_date,
      calendarEvent.is_all_day,
      calendarEvent.status,
      JSON.stringify(calendarEvent.extra),
    ],
  );

  await updateCalendarRevision(calendar);

  if (oldCalendar) {
    await updateCalendarRevision(oldCalendar);
  }
}

export async function deleteCalendarEvent(id: string, calendarId: string, userId: string) {
  const calendar = await getCalendar(calendarId, userId);

  if (!calendar) {
    throw new Error('Calendar not found');
  }

  await db.query(
    sql`DELETE FROM "bewcloud_calendar_events" WHERE "id" = $1 AND "calendar_id" = $2 AND "user_id" = $3`,
    [
      id,
      calendarId,
      userId,
    ],
  );

  await updateCalendarRevision(calendar);
}

export async function searchCalendarEvents(
  searchTerm: string,
  userId: string,
  calendarIds: string[],
): Promise<CalendarEvent[]> {
  const calendarEvents = await db.query<CalendarEvent>(
    sql`SELECT * FROM "bewcloud_calendar_events" WHERE "user_id" = $1 AND "calendar_id" = ANY($2) AND ("title" ILIKE $3 OR "extra"::text ILIKE $3) ORDER BY "start_date" ASC`,
    [
      userId,
      calendarIds,
      `%${searchTerm.split(' ').join('%')}%`,
    ],
  );

  return calendarEvents;
}
