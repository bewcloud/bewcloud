import { RRuleSet } from 'rrule-rust';

import Database, { sql } from '/lib/interfaces/database.ts';
import Locker from '/lib/interfaces/locker.ts';
import { Calendar, CalendarEvent, CalendarEventReminder } from '/lib/types.ts';
import { getRandomItem } from '/lib/utils/misc.ts';
import { CALENDAR_COLOR_OPTIONS, getVCalendarDate } from '/lib/utils/calendar.ts';
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
    // Fetch initial recurring events and calculate any necessary to create/show for the date range, if it's not in the past
    if (dateRange.end >= new Date()) {
      const lock = new Locker(`events-${userId}`);

      await lock.acquire();

      const initialRecurringCalendarEvents = await db.query<CalendarEvent>(
        sql`SELECT * FROM "bewcloud_calendar_events"
          WHERE "user_id" = $1
            AND "calendar_id" = ANY($2)
            AND "start_date" <= $3
            AND ("extra" ->> 'is_recurring')::boolean IS TRUE
            AND ("extra" ->> 'recurring_id')::uuid = "id"
          ORDER BY "start_date" ASC`,
        [
          userId,
          calendarIds,
          dateRange.end,
        ],
      );

      // For each initial recurring event, check instance dates, check if those exist in calendarEvents. If not, create them.
      for (const initialRecurringCalendarEvent of initialRecurringCalendarEvents) {
        try {
          const oneMonthAgo = new Date(new Date().setUTCMonth(new Date().getUTCMonth() - 1));

          let recurringInstanceStartDate = initialRecurringCalendarEvent.start_date;
          let lastSequence = initialRecurringCalendarEvent.extra.recurring_sequence!;

          if (recurringInstanceStartDate <= oneMonthAgo) {
            // Fetch the latest recurring sample, so we don't have to calculate as many recurring dates, but still preserve the original date's properties for generating the recurring instances
            const latestRecurringInstance = (await db.query<CalendarEvent>(
              sql`SELECT * FROM "bewcloud_calendar_events"
                WHERE "user_id" = $1
                  AND "calendar_id" = ANY($2)
                  AND "start_date" <= $3
                  AND ("extra" ->> 'is_recurring')::boolean IS TRUE
                  AND ("extra" ->> 'recurring_id')::uuid = $4
                ORDER BY ("extra" ->> 'recurring_sequence')::number DESC
                LIMIT 1`,
              [
                userId,
                calendarIds,
                dateRange.end,
                initialRecurringCalendarEvent.extra.recurring_id!,
              ],
            ))[0];

            if (latestRecurringInstance) {
              recurringInstanceStartDate = latestRecurringInstance.start_date;
              lastSequence = latestRecurringInstance.extra.recurring_sequence!;
            }
          }

          const rRuleSet = RRuleSet.parse(
            `DTSTART:${
              getVCalendarDate(recurringInstanceStartDate)
            }\n${initialRecurringCalendarEvent.extra.recurring_rrule}`,
          );

          const maxRecurringDatesToGenerate = 30;

          const timestamps = rRuleSet.all(maxRecurringDatesToGenerate);

          const validDates = timestamps.map((timestamp) => new Date(timestamp)).filter((date) => date <= dateRange.end);

          // For each date, check if an instance already exists. If not, create it and add it.
          for (const instanceDate of validDates) {
            instanceDate.setHours(recurringInstanceStartDate.getHours()); // NOTE: Something is making the hour shift when it shouldn't

            const matchingRecurringInstance = (await db.query<CalendarEvent>(
              sql`SELECT * FROM "bewcloud_calendar_events"
                WHERE "user_id" = $1
                  AND "calendar_id" = ANY($2)
                  AND "start_date" = $3
                  AND ("extra" ->> 'is_recurring')::boolean IS TRUE
                  AND ("extra" ->> 'recurring_id')::uuid = $4
                ORDER BY "start_date" ASC
                LIMIT 1`,
              [
                userId,
                calendarIds,
                instanceDate,
                initialRecurringCalendarEvent.extra.recurring_id!,
              ],
            ))[0];

            if (!matchingRecurringInstance) {
              const oneHourLater = new Date(new Date(instanceDate).setHours(instanceDate.getHours() + 1));
              const newCalendarEvent = await createCalendarEvent(
                userId,
                initialRecurringCalendarEvent.calendar_id,
                initialRecurringCalendarEvent.title,
                instanceDate,
                oneHourLater,
                initialRecurringCalendarEvent.is_all_day,
              );

              newCalendarEvent.extra = { ...newCalendarEvent.extra, ...initialRecurringCalendarEvent.extra };

              newCalendarEvent.extra.recurring_sequence = ++lastSequence;

              await updateCalendarEvent(newCalendarEvent);
            }
          }
        } catch (error) {
          console.error(`Error generating recurring instances: ${error}`);
          console.error(error);
        }
      }

      lock.release();
    }

    const calendarEvents = await db.query<CalendarEvent>(
      sql`SELECT * FROM "bewcloud_calendar_events"
        WHERE "user_id" = $1
          AND "calendar_id" = ANY($2)
          AND (
            ("start_date" >= $3 OR "end_date" <= $4)
            OR ("start_date" < $3 AND "end_date" > $4)
          )
        ORDER BY "start_date" ASC`,
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

  const oneHourEarlier = new Date(new Date(startDate).setHours(new Date(startDate).getHours() - 1));
  const sameDayAtNine = new Date(new Date(startDate).setHours(9));

  const newReminder: CalendarEventReminder = {
    start_date: isAllDay ? sameDayAtNine.toISOString() : oneHourEarlier.toISOString(),
    type: 'display',
  };

  const extra: CalendarEvent['extra'] = {
    organizer_email: user.email,
    transparency: 'default',
    reminders: [newReminder],
  };

  const revision = crypto.randomUUID();

  const status: CalendarEvent['status'] = 'scheduled';

  const newCalendarEvent = (await db.query<CalendarEvent>(
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

  return newCalendarEvent;
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

  const oldCalendarEvent = await getCalendarEvent(calendarEvent.id, user.id);

  if (oldCalendarEvent.start_date !== calendarEvent.start_date) {
    const oneHourEarlier = new Date(
      new Date(calendarEvent.start_date).setHours(new Date(calendarEvent.start_date).getHours() - 1),
    );
    const sameDayAtNine = new Date(new Date(calendarEvent.start_date).setHours(9));

    const newReminder: CalendarEventReminder = {
      start_date: calendarEvent.is_all_day ? sameDayAtNine.toISOString() : oneHourEarlier.toISOString(),
      type: 'display',
    };

    if (!Array.isArray(calendarEvent.extra.reminders)) {
      calendarEvent.extra.reminders = [newReminder];
    } else {
      if (calendarEvent.extra.reminders.length === 0) {
        calendarEvent.extra.reminders.push(newReminder);
      } else {
        calendarEvent.extra.reminders[0] = { ...calendarEvent.extra.reminders[0], start_date: newReminder.start_date };
      }
    }
  }

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
