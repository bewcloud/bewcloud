import { Calendar, CalendarEvent } from '/lib/types.ts';

interface CalendarViewDayProps {
  startDate: Date;
  visibleCalendars: Pick<Calendar, 'id' | 'name' | 'color'>[];
  calendarEvents: CalendarEvent[];
  onClickAddEvent: (startDate?: Date, isAllDay?: boolean) => void;
  onClickOpenEvent: (calendarEvent: CalendarEvent) => void;
}

export default function CalendarViewDay(
  { startDate, visibleCalendars, calendarEvents, onClickAddEvent, onClickOpenEvent }: CalendarViewDayProps,
) {
  const today = new Date().toISOString().substring(0, 10);

  const hourFormat = new Intl.DateTimeFormat('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const dayFormat = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const allDayEvents: CalendarEvent[] = calendarEvents.filter((calendarEvent) => {
    if (!calendarEvent.is_all_day) {
      return false;
    }

    const startDayDate = new Date(startDate);
    const endDayDate = new Date(startDate);
    endDayDate.setHours(23);
    endDayDate.setMinutes(59);
    endDayDate.setSeconds(59);
    endDayDate.setMilliseconds(999);

    const eventStartDate = new Date(calendarEvent.start_date);
    const eventEndDate = new Date(calendarEvent.end_date);

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
    date.setHours(hourNumber);

    const shortIsoDate = date.toISOString().substring(0, 10);

    const isCurrentHour = shortIsoDate === today && new Date().getHours() === hourNumber;

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
                        class={`flex px-2 py-2 rounded-md hover:no-underline hover:opacity-60 ${
                          visibleCalendars.find((calendar) => calendar.id === calendarEvent.calendar_id)
                            ?.color || 'bg-gray-700'
                        }`}
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
            startHourDate.setHours(hour.date.getHours());
            const endHourDate = new Date(shortIsoDate);
            endHourDate.setHours(hour.date.getHours());
            endHourDate.setMinutes(59);
            endHourDate.setSeconds(59);
            endHourDate.setMilliseconds(999);

            const isLastHour = hourIndex === 23;

            const hourEvents = calendarEvents.filter((calendarEvent) => {
              if (calendarEvent.is_all_day) {
                return false;
              }

              const eventStartDate = new Date(calendarEvent.start_date);
              const eventEndDate = new Date(calendarEvent.end_date);
              eventEndDate.setSeconds(eventEndDate.getSeconds() - 1); // Take one second back so events don't bleed into the next hour

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
                            class={`flex px-2 py-2 rounded-md hover:no-underline hover:opacity-60 ${
                              visibleCalendars.find((calendar) => calendar.id === hourEvent.calendar_id)
                                ?.color || 'bg-gray-700'
                            }`}
                            onClick={() => onClickOpenEvent(hourEvent)}
                          >
                            <time
                              datetime={new Date(hourEvent.start_date).toISOString()}
                              class='mr-2 flex-none text-slate-100 block'
                            >
                              {hourFormat.format(new Date(hourEvent.start_date))}
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
