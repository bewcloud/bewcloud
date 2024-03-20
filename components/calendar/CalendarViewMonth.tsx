import { Calendar, CalendarEvent } from '/lib/types.ts';
import { getWeeksForMonth } from '/lib/utils.ts';

interface CalendarViewWeekProps {
  startDate: Date;
  visibleCalendars: Pick<Calendar, 'id' | 'name' | 'color'>[];
  calendarEvents: CalendarEvent[];
  onClickAddEvent: (startDate?: Date, isAllDay?: boolean) => void;
  onClickOpenEvent: (calendarEvent: CalendarEvent) => void;
}

export default function CalendarViewWeek(
  { startDate, visibleCalendars, calendarEvents, onClickAddEvent, onClickOpenEvent }: CalendarViewWeekProps,
) {
  const today = new Date().toISOString().substring(0, 10);

  const hourFormat = new Intl.DateTimeFormat('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });

  const weeks = getWeeksForMonth(new Date(startDate));

  return (
    <section class='shadow-md flex flex-auto flex-col rounded-md'>
      <section class='grid grid-cols-7 gap-px border-b border-slate-500 bg-slate-700 text-center text-xs font-semibold text-white flex-none rounded-t-md'>
        <div class='flex justify-center bg-gray-900 py-2 rounded-tl-md'>
          <span>Mon</span>
        </div>
        <div class='flex justify-center bg-gray-900 py-2'>
          <span>Tue</span>
        </div>
        <div class='flex justify-center bg-gray-900 py-2'>
          <span>Wed</span>
        </div>
        <div class='flex justify-center bg-gray-900 py-2'>
          <span>Thu</span>
        </div>
        <div class='flex justify-center bg-gray-900 py-2'>
          <span>Fri</span>
        </div>
        <div class='flex justify-center bg-gray-900 py-2'>
          <span>Sat</span>
        </div>
        <div class='flex justify-center bg-gray-900 py-2 rounded-tr-md'>
          <span>Sun</span>
        </div>
      </section>
      <section class='flex bg-slate-500 text-xs text-white flex-auto rounded-b-md'>
        <section class='w-full grid grid-cols-7 grid-rows-5 gap-px rounded-b-md'>
          {weeks.map((week, weekIndex) =>
            week.map((day, dayIndex) => {
              const shortIsoDate = day.date.toISOString().substring(0, 10);

              const startDayDate = new Date(shortIsoDate);
              const endDayDate = new Date(shortIsoDate);
              endDayDate.setHours(23);
              endDayDate.setMinutes(59);
              endDayDate.setSeconds(59);
              endDayDate.setMilliseconds(999);

              const isBottomLeftDay = weekIndex === weeks.length - 1 && dayIndex === 0;
              const isBottomRightDay = weekIndex === weeks.length - 1 && dayIndex === week.length - 1;

              const isToday = today === shortIsoDate;

              const dayEvents = calendarEvents.filter((calendarEvent) => {
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

              return (
                <section
                  class={`relative ${day.isSameMonth ? 'bg-slate-600' : 'bg-slate-700'} min-h-16 px-3 py-2 ${
                    day.isSameMonth ? '' : 'text-slate-100'
                  } ${isBottomLeftDay ? 'rounded-bl-md' : ''} ${isBottomRightDay ? 'rounded-br-md' : ''}`}
                >
                  <time
                    datetime={shortIsoDate}
                    class={`cursor-pointer ${
                      isToday ? 'flex h-6 w-6 items-center justify-center rounded-full bg-[#51A4FB] font-semibold' : ''
                    }`}
                    onClick={() => onClickAddEvent(new Date(`${shortIsoDate}T09:00`))}
                    title='Add a new event'
                  >
                    {day.date.getDate()}
                  </time>
                  {dayEvents.length > 0
                    ? (
                      <ol class='mt-2'>
                        {[...dayEvents].slice(0, 2).map((dayEvent) => (
                          <li class='mb-1'>
                            <a
                              href='javascript:void(0);'
                              class={`flex px-2 py-1 rounded-md hover:no-underline hover:opacity-60 ${
                                visibleCalendars.find((calendar) => calendar.id === dayEvent.calendar_id)
                                  ?.color || 'bg-gray-700'
                              }`}
                              onClick={() => onClickOpenEvent(dayEvent)}
                            >
                              <time
                                datetime={new Date(dayEvent.start_date).toISOString()}
                                class='mr-2 flex-none text-slate-100 block'
                              >
                                {hourFormat.format(new Date(dayEvent.start_date))}
                              </time>
                              <p class='flex-auto truncate font-medium text-white'>
                                {dayEvent.title}
                              </p>
                            </a>
                          </li>
                        ))}
                        {dayEvents.length > 2
                          ? (
                            <li class='mb-1'>
                              <a
                                href={`/calendar/view=day&startDate=${shortIsoDate}`}
                                class='flex bg-gray-700 px-2 py-1 rounded-md hover:no-underline hover:opacity-60'
                                target='_blank'
                              >
                                <p class='flex-auto truncate font-medium text-white'>
                                  ...{dayEvents.length - 2} more event{dayEvents.length - 2 === 1 ? '' : 's'}
                                </p>
                              </a>
                            </li>
                          )
                          : null}
                      </ol>
                    )
                    : null}
                </section>
              );
            })
          )}
        </section>
      </section>
    </section>
  );
}
