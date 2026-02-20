import { getCalendarEventStyle, getDaysForWeek } from '/public/ts/utils/calendar.ts';
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
  const weekDayFormat = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: '2-digit',
    timeZone: timezoneId
  });
  const days = getDaysForWeek(new Date(startDate));
  return h("section", {
    class: "shadow-md flex flex-auto flex-col rounded-md"
  }, h("section", {
    class: "w-full grid gap-px grid-flow-col rounded-md text-white text-xs bg-slate-600 calendar-week-view-days"
  }, days.map((day, dayIndex) => {
    const allDayEvents = calendarEvents.filter(calendarEvent => {
      if (!calendarEvent.isAllDay) {
        return false;
      }
      const startDayDate = new Date(day.date);
      const endDayDate = new Date(day.date);
      endDayDate.setUTCHours(23);
      endDayDate.setUTCMinutes(59);
      endDayDate.setUTCSeconds(59);
      endDayDate.setUTCMilliseconds(999);
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
    const isFirstDay = dayIndex === 0;
    const isLastDay = dayIndex === 6;
    const isToday = new Date(day.date).toISOString().substring(0, 10) === today;
    return h(Fragment, null, h("section", {
      class: `flex justify-center ${isToday ? 'bg-[#51A4FB]' : 'bg-gray-900'} py-2 ${isFirstDay ? 'rounded-tl-md' : ''} ${isLastDay ? 'rounded-tr-md' : ''} text-center text-xs font-semibold text-white`
    }, h("span", null, weekDayFormat.format(day.date))), h("section", {
      class: `relative bg-slate-700 min-h-8 px-3 py-2 text-slate-100`
    }, h("time", {
      datetime: new Date(startDate).toISOString().substring(0, 10),
      onClick: () => onClickAddEvent(new Date(startDate), true),
      class: "cursor-pointer",
      title: "Add a new all-day event"
    }, "All-day"), allDayEvents.length > 0 ? h("ol", {
      class: "mt-2"
    }, allDayEvents.map(calendarEvent => h("li", {
      class: "mb-1"
    }, h("a", {
      href: "javascript:void(0);",
      class: `flex px-2 py-2 rounded-md hover:no-underline hover:opacity-60`,
      style: getCalendarEventStyle(calendarEvent, visibleCalendars),
      onClick: () => onClickOpenEvent(calendarEvent)
    }, h("p", {
      class: "flex-auto truncate font-medium text-white"
    }, calendarEvent.title))))) : null), day.hours.map((hour, hourIndex) => {
      const shortIsoDate = hour.date.toISOString().substring(0, 10);
      const startHourDate = new Date(shortIsoDate);
      startHourDate.setUTCHours(hour.date.getUTCHours());
      const endHourDate = new Date(shortIsoDate);
      endHourDate.setUTCHours(hour.date.getUTCHours());
      endHourDate.setUTCMinutes(59);
      endHourDate.setUTCSeconds(59);
      endHourDate.setUTCMilliseconds(999);
      const isLastHourOfFirstDay = hourIndex === 23 && dayIndex === 0;
      const isLastHourOfLastDay = hourIndex === 23 && dayIndex === 6;
      const hourEvents = calendarEvents.filter(calendarEvent => {
        if (calendarEvent.isAllDay) {
          return false;
        }
        const eventStartDate = new Date(calendarEvent.startDate);
        const eventEndDate = new Date(calendarEvent.endDate);
        eventEndDate.setUTCSeconds(eventEndDate.getUTCSeconds() - 1);
        if (eventStartDate >= startHourDate && eventEndDate <= endHourDate) {
          return true;
        }
        if (eventStartDate <= startHourDate && eventEndDate >= endHourDate) {
          return true;
        }
        if (eventStartDate >= startHourDate && eventStartDate <= endHourDate && eventEndDate >= endHourDate) {
          return true;
        }
        if (eventStartDate <= startHourDate && eventEndDate >= startHourDate && eventEndDate <= endHourDate) {
          return true;
        }
        return false;
      });
      return h("section", {
        class: `relative ${hour.isCurrentHour ? 'bg-slate-600' : 'bg-slate-700'} px-3 py-2 ${hour.isCurrentHour ? '' : 'text-slate-100'} ${isLastHourOfFirstDay ? 'rounded-bl-md' : ''} ${isLastHourOfLastDay ? 'rounded-br-md' : ''}`
      }, h("time", {
        datetime: startHourDate.toISOString(),
        onClick: () => onClickAddEvent(startHourDate),
        class: "cursor-pointer",
        title: "Add a new event"
      }, hourFormat.format(startHourDate)), hourEvents.length > 0 ? h("ol", {
        class: "mt-2"
      }, hourEvents.map(hourEvent => h("li", {
        class: "mb-1"
      }, h("a", {
        href: "javascript:void(0);",
        class: `flex px-2 py-2 rounded-md hover:no-underline hover:opacity-60`,
        style: getCalendarEventStyle(hourEvent, visibleCalendars),
        onClick: () => onClickOpenEvent(hourEvent)
      }, h("time", {
        datetime: new Date(hourEvent.startDate).toISOString(),
        class: "mr-2 flex-none text-slate-100 block"
      }, hourFormat.format(new Date(hourEvent.startDate))), h("p", {
        class: "flex-auto truncate font-medium text-white"
      }, hourEvent.title))))) : null);
    }));
  })));
}