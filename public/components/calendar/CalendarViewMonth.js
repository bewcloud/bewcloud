import { getCalendarEventStyle, getWeeksForMonth } from '/public/ts/utils/calendar.ts';
export default function CalendarViewWeek({
  startDate,
  visibleCalendars,
  calendarEvents,
  onClickAddEvent,
  onClickOpenEvent,
  timezoneId
}) {
  const today = new Date().toISOString().substring(0, 10);
  const hourFormat = new Intl.DateTimeFormat('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezoneId
  });
  const weeks = getWeeksForMonth(new Date(startDate));
  return h("section", {
    class: "shadow-md flex flex-auto flex-col rounded-md"
  }, h("section", {
    class: "grid grid-cols-7 gap-px border-b border-slate-500 bg-slate-700 text-center text-xs font-semibold text-white flex-none rounded-t-md"
  }, h("div", {
    class: "flex justify-center bg-gray-900 py-2 rounded-tl-md"
  }, h("span", null, "Mon")), h("div", {
    class: "flex justify-center bg-gray-900 py-2"
  }, h("span", null, "Tue")), h("div", {
    class: "flex justify-center bg-gray-900 py-2"
  }, h("span", null, "Wed")), h("div", {
    class: "flex justify-center bg-gray-900 py-2"
  }, h("span", null, "Thu")), h("div", {
    class: "flex justify-center bg-gray-900 py-2"
  }, h("span", null, "Fri")), h("div", {
    class: "flex justify-center bg-gray-900 py-2"
  }, h("span", null, "Sat")), h("div", {
    class: "flex justify-center bg-gray-900 py-2 rounded-tr-md"
  }, h("span", null, "Sun"))), h("section", {
    class: "flex bg-slate-500 text-xs text-white flex-auto rounded-b-md"
  }, h("section", {
    class: "w-full grid grid-cols-7 grid-rows-5 gap-px rounded-b-md"
  }, weeks.map((week, weekIndex) => week.map((day, dayIndex) => {
    const shortIsoDate = day.date.toISOString().substring(0, 10);
    const startDayDate = new Date(shortIsoDate);
    const endDayDate = new Date(shortIsoDate);
    endDayDate.setUTCHours(23);
    endDayDate.setUTCMinutes(59);
    endDayDate.setUTCSeconds(59);
    endDayDate.setUTCMilliseconds(999);
    const isBottomLeftDay = weekIndex === weeks.length - 1 && dayIndex === 0;
    const isBottomRightDay = weekIndex === weeks.length - 1 && dayIndex === week.length - 1;
    const isToday = today === shortIsoDate;
    const dayEvents = calendarEvents.filter(calendarEvent => {
      const eventStartDate = new Date(calendarEvent.startDate);
      const eventEndDate = new Date(calendarEvent.endDate);
      if (eventStartDate >= startDayDate && eventEndDate <= endDayDate) {
        return true;
      }
      if (eventStartDate <= startDayDate && eventEndDate >= endDayDate) {
        return true;
      }
      if (eventStartDate >= startDayDate && eventStartDate <= endDayDate && eventEndDate >= endDayDate) {
        return true;
      }
      if (eventStartDate <= startDayDate && eventEndDate >= startDayDate && eventEndDate <= endDayDate) {
        return true;
      }
      return false;
    });
    return h("section", {
      class: `relative ${day.isSameMonth ? 'bg-slate-600' : 'bg-slate-700'} min-h-16 px-3 py-2 ${day.isSameMonth ? '' : 'text-slate-100'} ${isBottomLeftDay ? 'rounded-bl-md' : ''} ${isBottomRightDay ? 'rounded-br-md' : ''}`
    }, h("time", {
      datetime: shortIsoDate,
      class: `cursor-pointer ${isToday ? 'flex h-6 w-6 items-center justify-center rounded-full bg-[#51A4FB] font-semibold' : ''}`,
      onClick: () => onClickAddEvent(new Date(`${shortIsoDate}T09:00`)),
      title: "Add a new event"
    }, day.date.getUTCDate()), dayEvents.length > 0 ? h("ol", {
      class: "mt-2"
    }, [...dayEvents].slice(0, 2).map(dayEvent => h("li", {
      class: "mb-1"
    }, h("a", {
      href: "javascript:void(0);",
      class: `flex px-2 py-1 rounded-md hover:no-underline hover:opacity-60`,
      style: getCalendarEventStyle(dayEvent, visibleCalendars),
      onClick: () => onClickOpenEvent(dayEvent)
    }, h("time", {
      datetime: new Date(dayEvent.startDate).toISOString(),
      class: "mr-2 flex-none text-slate-100 block"
    }, hourFormat.format(new Date(dayEvent.startDate))), h("p", {
      class: "flex-auto truncate font-medium text-white"
    }, dayEvent.title)))), dayEvents.length > 2 ? h("li", {
      class: "mb-1"
    }, h("a", {
      href: `/calendar/view=day&startDate=${shortIsoDate}`,
      class: "flex bg-gray-700 px-2 py-1 rounded-md hover:no-underline hover:opacity-60",
      target: "_blank"
    }, h("p", {
      class: "flex-auto truncate font-medium text-white"
    }, "...", dayEvents.length - 2, " more event", dayEvents.length - 2 === 1 ? '' : 's'))) : null) : null);
  })))));
}