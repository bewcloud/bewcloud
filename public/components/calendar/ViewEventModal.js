import { convertRRuleToWords } from '/public/ts/utils/calendar.ts';
export default function ViewEventModal({
  isOpen,
  calendarEvent,
  calendar,
  onClickDelete,
  onClose,
  timezoneId
}) {
  if (!calendarEvent || !calendar) {
    return null;
  }
  const allDayEventDateFormat = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezoneId
  });
  const hourFormat = new Intl.DateTimeFormat('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezoneId
  });
  return h(Fragment, null, h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`
  }), h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-96 max-w-lg bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`
  }, h("h1", {
    class: "text-2xl font-semibold my-5"
  }, calendarEvent.title), h("header", {
    class: "py-5 border-t border-b border-slate-500 font-semibold flex justify-between items-center"
  }, h("span", null, calendarEvent.startDate ? allDayEventDateFormat.format(new Date(calendarEvent.startDate)) : ''), calendarEvent.isAllDay ? h("span", null, "All-day") : h("span", null, calendarEvent.startDate ? hourFormat.format(new Date(calendarEvent.startDate)) : '', " -", ' ', calendarEvent.endDate ? hourFormat.format(new Date(calendarEvent.endDate)) : '')), h("section", {
    class: "py-5 my-0 border-b border-slate-500 flex justify-between items-center"
  }, h("span", null, calendar.displayName), h("span", {
    class: `w-5 h-5 ml-2 block rounded-full`,
    title: calendar.calendarColor,
    style: {
      backgroundColor: calendar.calendarColor
    }
  })), calendarEvent.description ? h("section", {
    class: "py-5 my-0 border-b border-slate-500"
  }, h("article", {
    class: "overflow-auto max-w-full max-h-80 font-mono text-sm whitespace-pre-wrap"
  }, calendarEvent.description)) : null, calendarEvent.eventUrl ? h("section", {
    class: "py-5 my-0 border-b border-slate-500"
  }, h("a", {
    href: calendarEvent.eventUrl,
    target: "_blank",
    rel: "noopener noreferrer"
  }, calendarEvent.eventUrl)) : null, calendarEvent.location ? h("section", {
    class: "py-5 my-0 border-b border-slate-500"
  }, h("a", {
    href: `https://www.openstreetmap.org/search?query=${encodeURIComponent(calendarEvent.location)}`,
    target: "_blank",
    rel: "noopener noreferrer"
  }, calendarEvent.location)) : null, Array.isArray(calendarEvent.attendees) && calendarEvent.attendees.length > 0 ? h("section", {
    class: "py-5 my-0 border-b border-slate-500"
  }, calendarEvent.attendees.map(attendee => h("p", {
    class: "my-1"
  }, h("a", {
    href: `mailto:${attendee.email}`,
    target: "_blank",
    rel: "noopener noreferrer"
  }, attendee.name || attendee.email), ' ', "- ", attendee.status))) : null, calendarEvent.isRecurring && calendarEvent.recurringRrule ? h("section", {
    class: "py-5 my-0 border-b border-slate-500"
  }, h("p", {
    class: "text-xs"
  }, "Repeats ", convertRRuleToWords(calendarEvent.recurringRrule, {
    capitalizeSentence: false
  }), ".")) : null, Array.isArray(calendarEvent.reminders) && calendarEvent.reminders.length > 0 ? h("section", {
    class: "py-5 my-0 border-b border-slate-500"
  }, calendarEvent.reminders.map(reminder => h("p", {
    class: "my-1 text-xs"
  }, reminder.description || 'Reminder', " at ", hourFormat.format(new Date(reminder.startDate)), " via", ' ', reminder.type, "."))) : null, h("footer", {
    class: "flex justify-between mt-2"
  }, h("button", {
    type: "button",
    class: "px-5 py-2 bg-slate-600 hover:bg-red-600 text-white cursor-pointer rounded-md",
    onClick: () => onClickDelete(calendarEvent.uid)
  }, "Delete"), h("a", {
    href: `/calendar/${calendarEvent.uid}?calendarId=${calendar.uid}`,
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    target: "_blank"
  }, "Edit"), h("button", {
    type: "button",
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md",
    onClick: () => onClose()
  }, "Close"))));
}