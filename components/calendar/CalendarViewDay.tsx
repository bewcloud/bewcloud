import { Calendar, CalendarEvent } from '/lib/models/calendar.ts';
import { getCalendarEventStyle } from '/public/ts/utils/calendar.ts';

interface CalendarViewDayProps {
  startDate: Date;
  visibleCalendars: Calendar[];
  calendarEvents: CalendarEvent[];
  onClickAddEvent: (startDate?: Date, isAllDay?: boolean) => void;
  onClickOpenEvent: (calendarEvent: CalendarEvent) => void;
  timezoneId: string;
}

export default function CalendarViewDay(
  { startDate, visibleCalendars, calendarEvents, onClickAddEvent, onClickOpenEvent, timezoneId }: CalendarViewDayProps,
) {
  const today = new Date().toISOString().substring(0, 10);

  const hourFormat = new Intl.DateTimeFormat('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezoneId, // Calendar dates are parsed are stored without timezone info, so we need to force to a specific one so it's consistent across db, server, and client
  });
  const dayFormat = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezoneId, // Calendar dates are parsed without timezone info, so we need to force to a specific one so it's consistent across db, server, and client
  });

  const allDayEvents: CalendarEvent[] = calendarEvents.filter((calendarEvent) => {
    if (!calendarEvent.isAllDay) {
      return false;
    }

    const startDayDate = new Date(startDate);
    const endDayDate = new Date(startDate);
    endDayDate.setUTCHours(23);
    endDayDate.setUTCMinutes(59);
    endDayDate.setUTCSeconds(59);
    endDayDate.setUTCMilliseconds(999);

    const eventStartDate = new Date(calendarEvent.startDate);
    const eventEndDate = new Date(calendarEvent.endDate);

    // Event starts and ends on this day
    if (eventStartDate >= startDayDate && eventEndDate <= endDayDate) {
      return true;
    }

    // Event starts before and ends after this day
    if (eventStartDate <= startDayDate && eventEndDate >= endDayDate) {
      return true;
    }

    // Event starts on and ends after this day
    if (
      eventStartDate >= startDayDate && eventStartDate <= endDayDate && eventEndDate >= endDayDate
    ) {
      return true;
    }

    // Event starts before and ends on this day
    if (
      eventStartDate <= startDayDate && eventEndDate >= startDayDate && eventEndDate <= endDayDate
    ) {
      return true;
    }

    return false;
  });

  const hours: { date: Date; isCurrentHour: boolean }[] = Array.from({ length: 24 }).map((_, index) => {
    const hourNumber = index;

    const date = new Date(startDate);
    date.setUTCHours(hourNumber);

    const shortIsoDate = date.toISOString().substring(0, 10);

    const isCurrentHour = shortIsoDate === today && new Date().getUTCHours() === hourNumber;

    return {
      date,
      isCurrentHour,
    };
  });

  return (
    <section class='shadow-md flex flex-auto flex-col rounded-md'>
      <section class='border-b border-slate-500 bg-slate-700 text-center text-base font-semibold text-white flex-none rounded-t-md'>
        <div class='flex justify-center bg-gray-900 py-2 rounded-t-md'>
          <span>{dayFormat.format(startDate)}</span>
        </div>
      </section>
      <section class='flex bg-slate-500 text-sm text-white flex-auto rounded-b-md'>
        <section class='w-full rounded-b-md'>
          {allDayEvents.length > 0
            ? (
              <section
                class={`relative bg-slate-700 min-h-16 px-3 py-2 text-slate-100 border-b border-b-slate-600`}
              >
                <time
                  datetime={new Date(startDate).toISOString().substring(0, 10)}
                  onClick={() => onClickAddEvent(new Date(startDate), true)}
                  class='cursor-pointer'
                  title='Add a new all-day event'
                >
                  All-day
                </time>
                <ol class='mt-2'>
                  {allDayEvents.map((calendarEvent) => (
                    <li class='mb-1'>
                      <a
                        href='javascript:void(0);'
                        class={`flex px-2 py-2 rounded-md hover:no-underline hover:opacity-60`}
                        style={getCalendarEventStyle(calendarEvent, visibleCalendars)}
                        onClick={() => onClickOpenEvent(calendarEvent)}
                      >
                        <p class='flex-auto truncate font-medium text-white'>
                          {calendarEvent.title}
                        </p>
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            )
            : null}
          {hours.map((hour, hourIndex) => {
            const shortIsoDate = hour.date.toISOString().substring(0, 10);

            const startHourDate = new Date(shortIsoDate);
            startHourDate.setUTCHours(hour.date.getUTCHours());
            const endHourDate = new Date(shortIsoDate);
            endHourDate.setUTCHours(hour.date.getUTCHours());
            endHourDate.setUTCMinutes(59);
            endHourDate.setUTCSeconds(59);
            endHourDate.setUTCMilliseconds(999);

            const isLastHour = hourIndex === 23;

            const hourEvents = calendarEvents.filter((calendarEvent) => {
              if (calendarEvent.isAllDay) {
                return false;
              }

              const eventStartDate = new Date(calendarEvent.startDate);
              const eventEndDate = new Date(calendarEvent.endDate);
              eventEndDate.setUTCSeconds(eventEndDate.getUTCSeconds() - 1); // Take one second back so events don't bleed into the next hour

              // Event starts and ends on this hour
              if (eventStartDate >= startHourDate && eventEndDate <= endHourDate) {
                return true;
              }

              // Event starts before and ends after this hour
              if (eventStartDate <= startHourDate && eventEndDate >= endHourDate) {
                return true;
              }

              // Event starts on and ends after this hour
              if (
                eventStartDate >= startHourDate && eventStartDate <= endHourDate && eventEndDate >= endHourDate
              ) {
                return true;
              }

              // Event starts before and ends on this hour
              if (
                eventStartDate <= startHourDate && eventEndDate >= startHourDate && eventEndDate <= endHourDate
              ) {
                return true;
              }

              return false;
            });

            return (
              <section
                class={`relative ${hour.isCurrentHour ? 'bg-slate-600' : 'bg-slate-700'} ${
                  hourIndex <= 6 ? 'min-h-8' : 'min-h-16'
                } px-3 py-2 ${hour.isCurrentHour ? '' : 'text-slate-100'} ${
                  isLastHour ? 'rounded-b-md' : ''
                } border-b border-b-slate-600`}
              >
                <time
                  datetime={startHourDate.toISOString()}
                  onClick={() => onClickAddEvent(startHourDate)}
                  class='cursor-pointer'
                  title='Add a new event'
                >
                  {hourFormat.format(startHourDate)}
                </time>
                {hourEvents.length > 0
                  ? (
                    <ol class='mt-2'>
                      {hourEvents.map((hourEvent) => (
                        <li class='mb-1'>
                          <a
                            href='javascript:void(0);'
                            class={`flex px-2 py-2 rounded-md hover:no-underline hover:opacity-60`}
                            style={getCalendarEventStyle(hourEvent, visibleCalendars)}
                            onClick={() => onClickOpenEvent(hourEvent)}
                          >
                            <time
                              datetime={new Date(hourEvent.startDate).toISOString()}
                              class='mr-2 flex-none text-slate-100 block'
                            >
                              {hourFormat.format(new Date(hourEvent.startDate))}
                            </time>
                            <p class='flex-auto truncate font-medium text-white'>
                              {hourEvent.title}
                            </p>
                          </a>
                        </li>
                      ))}
                    </ol>
                  )
                  : null}
              </section>
            );
          })}
        </section>
      </section>
    </section>
  );
}
