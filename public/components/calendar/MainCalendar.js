import { useSignal } from '@preact/signals';
import { capitalizeWord } from '/public/ts/utils/misc.ts';
import { generateVCalendar } from '/public/ts/utils/calendar.ts';
import CalendarViewDay from "./CalendarViewDay.js";
import CalendarViewWeek from "./CalendarViewWeek.js";
import CalendarViewMonth from "./CalendarViewMonth.js";
import AddEventModal from "./AddEventModal.js";
import ViewEventModal from "./ViewEventModal.js";
import SearchEvents from "./SearchEvents.js";
import ImportEventsModal from "./ImportEventsModal.js";
export default function MainCalendar({
  initialCalendars,
  initialCalendarEvents,
  view,
  startDate,
  baseUrl,
  timezoneId
}) {
  const isAdding = useSignal(false);
  const isDeleting = useSignal(false);
  const isExporting = useSignal(false);
  const isImporting = useSignal(false);
  const calendars = useSignal(initialCalendars);
  const isViewOptionsDropdownOpen = useSignal(false);
  const isImportExportOptionsDropdownOpen = useSignal(false);
  const calendarEvents = useSignal(initialCalendarEvents);
  const openEventModal = useSignal({
    isOpen: false
  });
  const newEventModal = useSignal({
    isOpen: false
  });
  const openImportModal = useSignal({
    isOpen: false
  });
  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    timeZone: timezoneId
  });
  const today = new Date().toISOString().substring(0, 10);
  const visibleCalendars = calendars.value.filter(calendar => calendar.isVisible);
  function onClickAddEvent(startDate = new Date(), isAllDay = false) {
    if (newEventModal.value.isOpen) {
      newEventModal.value = {
        isOpen: false
      };
      return;
    }
    if (calendars.value.length === 0) {
      alert('You need to create a calendar first!');
      return;
    }
    newEventModal.value = {
      isOpen: true,
      initialStartDate: startDate,
      initiallyAllDay: isAllDay
    };
  }
  async function onClickSaveNewEvent(newEvent) {
    if (isAdding.value) {
      return;
    }
    if (!newEvent) {
      return;
    }
    isAdding.value = true;
    try {
      const requestBody = {
        calendarIds: visibleCalendars.map(calendar => calendar.uid),
        calendarView: view,
        calendarStartDate: startDate,
        calendarId: newEvent.calendarId,
        title: newEvent.title,
        startDate: new Date(newEvent.startDate).toISOString(),
        endDate: new Date(newEvent.endDate).toISOString(),
        isAllDay: newEvent.isAllDay
      };
      const response = await fetch(`/api/calendar/add-event`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to add event!');
      }
      calendarEvents.value = [...result.newCalendarEvents];
      newEventModal.value = {
        isOpen: false
      };
    } catch (error) {
      console.error(error);
    }
    isAdding.value = false;
  }
  function onCloseNewEvent() {
    newEventModal.value = {
      isOpen: false
    };
  }
  function toggleImportExportOptionsDropdown() {
    isImportExportOptionsDropdownOpen.value = !isImportExportOptionsDropdownOpen.value;
  }
  function toggleViewOptionsDropdown() {
    isViewOptionsDropdownOpen.value = !isViewOptionsDropdownOpen.value;
  }
  function onClickOpenEvent(calendarEvent) {
    if (openEventModal.value.isOpen) {
      openEventModal.value = {
        isOpen: false
      };
      return;
    }
    const calendar = calendars.value.find(calendar => calendar.uid === calendarEvent.calendarId);
    openEventModal.value = {
      isOpen: true,
      calendar,
      calendarEvent
    };
  }
  async function onClickDeleteEvent(calendarEventId) {
    if (confirm('Are you sure you want to delete this event?')) {
      if (isDeleting.value) {
        return;
      }
      isDeleting.value = true;
      try {
        const requestBody = {
          calendarIds: visibleCalendars.map(calendar => calendar.uid),
          calendarView: view,
          calendarStartDate: startDate,
          calendarEventId,
          calendarId: calendarEvents.value.find(calendarEvent => calendarEvent.uid === calendarEventId).calendarId
        };
        const response = await fetch(`/api/calendar/delete-event`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error('Failed to delete event!');
        }
        calendarEvents.value = [...result.newCalendarEvents];
      } catch (error) {
        console.error(error);
      }
      isDeleting.value = false;
      openEventModal.value = {
        isOpen: false
      };
    }
  }
  function onCloseOpenEvent() {
    openEventModal.value = {
      isOpen: false
    };
  }
  function onClickChangeStartDate(changeTo) {
    const previousDay = new Date(new Date(startDate).setUTCDate(new Date(startDate).getUTCDate() - 1)).toISOString().substring(0, 10);
    const nextDay = new Date(new Date(startDate).setUTCDate(new Date(startDate).getUTCDate() + 1)).toISOString().substring(0, 10);
    const previousWeek = new Date(new Date(startDate).setUTCDate(new Date(startDate).getUTCDate() - 7)).toISOString().substring(0, 10);
    const nextWeek = new Date(new Date(startDate).setUTCDate(new Date(startDate).getUTCDate() + 7)).toISOString().substring(0, 10);
    const previousMonth = new Date(new Date(startDate).setUTCMonth(new Date(startDate).getUTCMonth() - 1)).toISOString().substring(0, 10);
    const nextMonth = new Date(new Date(startDate).setUTCMonth(new Date(startDate).getUTCMonth() + 1)).toISOString().substring(0, 10);
    if (changeTo === 'today') {
      if (today === startDate) {
        return;
      }
      window.location.href = `/calendar?view=${view}&startDate=${today}`;
      return;
    }
    if (changeTo === 'previous') {
      let newStartDate = previousMonth;
      if (view === 'day') {
        newStartDate = previousDay;
      } else if (view === 'week') {
        newStartDate = previousWeek;
      }
      if (newStartDate === startDate) {
        return;
      }
      window.location.href = `/calendar?view=${view}&startDate=${newStartDate}`;
      return;
    }
    let newStartDate = nextMonth;
    if (view === 'day') {
      newStartDate = nextDay;
    } else if (view === 'week') {
      newStartDate = nextWeek;
    }
    if (newStartDate === startDate) {
      return;
    }
    window.location.href = `/calendar?view=${view}&startDate=${newStartDate}`;
  }
  function onClickChangeView(newView) {
    if (view === newView) {
      isViewOptionsDropdownOpen.value = false;
      return;
    }
    window.location.href = `/calendar?view=${newView}&startDate=${startDate}`;
  }
  function onClickImportICS() {
    openImportModal.value = {
      isOpen: true
    };
    isImportExportOptionsDropdownOpen.value = false;
  }
  function onClickChooseImportCalendar(calendarId) {
    isImportExportOptionsDropdownOpen.value = false;
    if (isImporting.value) {
      return;
    }
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.click();
    fileInput.onchange = event => {
      const files = event.target?.files;
      const file = files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = async fileRead => {
        const importFileContents = fileRead.target?.result;
        if (!importFileContents || isImporting.value) {
          return;
        }
        isImporting.value = true;
        openImportModal.value = {
          isOpen: false
        };
        try {
          const icsToImport = importFileContents.toString();
          const requestBody = {
            icsToImport,
            calendarIds: visibleCalendars.map(calendar => calendar.uid),
            calendarView: view,
            calendarStartDate: startDate,
            calendarId
          };
          const response = await fetch(`/api/calendar/import`, {
            method: 'POST',
            body: JSON.stringify(requestBody)
          });
          const result = await response.json();
          if (!result.success) {
            throw new Error('Failed to import file!');
          }
          calendarEvents.value = [...result.newCalendarEvents];
        } catch (error) {
          console.error(error);
        }
        isImporting.value = false;
      };
      reader.readAsText(file, 'UTF-8');
    };
  }
  async function onClickExportICS() {
    isImportExportOptionsDropdownOpen.value = false;
    if (isExporting.value) {
      return;
    }
    isExporting.value = true;
    const fileName = ['calendar-', new Date().toISOString().substring(0, 19).replace(/:/g, '-'), '.ics'].join('');
    try {
      const requestBody = {
        calendarIds: visibleCalendars.map(calendar => calendar.uid)
      };
      const response = await fetch(`/api/calendar/export-events`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to get contact!');
      }
      const exportContents = generateVCalendar([...result.calendarEvents]);
      const vCardContent = ['data:text/calendar; charset=utf-8,', encodeURIComponent(exportContents)].join('');
      const data = vCardContent;
      const link = document.createElement('a');
      link.setAttribute('href', data);
      link.setAttribute('download', fileName);
      link.click();
      link.remove();
    } catch (error) {
      console.error(error);
    }
    isExporting.value = false;
  }
  return h(Fragment, null, h("section", {
    class: "flex flex-row items-center justify-between mb-4"
  }, h("section", {
    class: "relative inline-block text-left mr-2"
  }, h("section", {
    class: "flex flex-row items-center justify-start"
  }, h("a", {
    href: "/calendars",
    class: "mr-4 whitespace-nowrap"
  }, "Manage calendars"), h(SearchEvents, {
    calendars: visibleCalendars,
    onClickOpenEvent: onClickOpenEvent
  }))), h("section", {
    class: "flex items-center justify-end"
  }, h("h3", {
    class: "text-base font-semibold text-white whitespace-nowrap mr-2"
  }, h("time", {
    datetime: startDate
  }, dateFormat.format(new Date(startDate)))), h("section", {
    class: "ml-2 relative flex items-center rounded-md bg-slate-700 shadow-sm md:items-stretch"
  }, h("button", {
    type: "button",
    class: "flex h-9 w-12 items-center justify-center rounded-l-md text-white hover:bg-slate-600 focus:relative",
    onClick: () => onClickChangeStartDate('previous')
  }, h("span", {
    class: "sr-only"
  }, "Previous ", view), h("svg", {
    class: "h-5 w-5",
    viewBox: "0 0 20 20",
    fill: "currentColor",
    "aria-hidden": "true"
  }, h("path", {
    "fill-rule": "evenodd",
    d: "M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z",
    "clip-rule": "evenodd"
  }))), h("button", {
    type: "button",
    class: "px-3.5 text-sm font-semibold text-white hover:bg-slate-600 focus:relative",
    onClick: () => onClickChangeStartDate('today')
  }, "Today"), h("button", {
    type: "button",
    class: "flex h-9 w-12 items-center justify-center rounded-r-md text-white hover:bg-slate-600 pl-1 focus:relative",
    onClick: () => onClickChangeStartDate('next')
  }, h("span", {
    class: "sr-only"
  }, "Next ", view), h("svg", {
    class: "h-5 w-5",
    viewBox: "0 0 20 20",
    fill: "currentColor",
    "aria-hidden": "true"
  }, h("path", {
    "fill-rule": "evenodd",
    d: "M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z",
    "clip-rule": "evenodd"
  })))), h("section", {
    class: "relative inline-block text-left ml-2"
  }, h("div", null, h("button", {
    type: "button",
    class: "inline-flex w-full justify-center gap-x-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600",
    id: "view-button",
    "aria-expanded": "true",
    "aria-haspopup": "true",
    onClick: () => toggleViewOptionsDropdown()
  }, capitalizeWord(view), h("svg", {
    class: "-mr-1 h-5 w-5 text-white",
    viewBox: "0 0 20 20",
    fill: "currentColor",
    "aria-hidden": "true"
  }, h("path", {
    "fill-rule": "evenodd",
    d: "M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z",
    "clip-rule": "evenodd"
  })))), h("div", {
    class: `absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${!isViewOptionsDropdownOpen.value ? 'hidden' : ''}`,
    role: "menu",
    "aria-orientation": "vertical",
    "aria-labelledby": "view-button",
    tabindex: -1
  }, h("div", {
    class: "py-1"
  }, h("button", {
    type: "button",
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600 ${view === 'day' ? 'font-semibold' : ''}`,
    onClick: () => onClickChangeView('day')
  }, "Day"), h("button", {
    type: "button",
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600 ${view === 'week' ? 'font-semibold' : ''}`,
    onClick: () => onClickChangeView('week')
  }, "Week"), h("button", {
    type: "button",
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600 ${view === 'month' ? 'font-semibold' : ''}`,
    onClick: () => onClickChangeView('month')
  }, "Month")))), h("section", {
    class: "relative inline-block text-left ml-2"
  }, h("div", null, h("button", {
    type: "button",
    class: "inline-flex w-full justify-center gap-x-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600",
    id: "import-export-button",
    "aria-expanded": "true",
    "aria-haspopup": "true",
    onClick: () => toggleImportExportOptionsDropdown()
  }, "ICS", h("svg", {
    class: "-mr-1 h-5 w-5 text-slate-400",
    viewBox: "0 0 20 20",
    fill: "currentColor",
    "aria-hidden": "true"
  }, h("path", {
    "fill-rule": "evenodd",
    d: "M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z",
    "clip-rule": "evenodd"
  })))), h("div", {
    class: `absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${!isImportExportOptionsDropdownOpen.value ? 'hidden' : ''}`,
    role: "menu",
    "aria-orientation": "vertical",
    "aria-labelledby": "import-export-button",
    tabindex: -1
  }, h("div", {
    class: "py-1"
  }, h("button", {
    type: "button",
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickImportICS()
  }, "Import ICS"), h("button", {
    type: "button",
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickExportICS()
  }, "Export ICS")))), h("button", {
    class: "inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2",
    type: "button",
    title: "Add new event",
    onClick: () => onClickAddEvent()
  }, h("img", {
    src: "/public/images/add.svg",
    alt: "Add new event",
    class: `white ${isAdding.value ? 'animate-spin' : ''}`,
    width: 20,
    height: 20
  })))), h("section", {
    class: "mx-auto max-w-7xl my-8"
  }, view === 'day' ? h(CalendarViewDay, {
    startDate: new Date(startDate),
    visibleCalendars: visibleCalendars,
    calendarEvents: calendarEvents.value,
    onClickAddEvent: onClickAddEvent,
    onClickOpenEvent: onClickOpenEvent,
    timezoneId: timezoneId
  }) : null, view === 'week' ? h(CalendarViewWeek, {
    startDate: new Date(startDate),
    visibleCalendars: visibleCalendars,
    calendarEvents: calendarEvents.value,
    onClickAddEvent: onClickAddEvent,
    onClickOpenEvent: onClickOpenEvent,
    timezoneId: timezoneId
  }) : null, view === 'month' ? h(CalendarViewMonth, {
    startDate: new Date(startDate),
    visibleCalendars: visibleCalendars,
    calendarEvents: calendarEvents.value,
    onClickAddEvent: onClickAddEvent,
    onClickOpenEvent: onClickOpenEvent,
    timezoneId: timezoneId
  }) : null, h("span", {
    class: `flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`
  }, isDeleting.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Deleting...") : null, isExporting.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Exporting...") : null, isImporting.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Importing...") : null, !isDeleting.value && !isExporting.value && !isImporting.value ? h(Fragment, null, "\xA0") : null)), h("section", {
    class: "flex flex-row items-center justify-start my-12"
  }, h("span", {
    class: "font-semibold"
  }, "CalDav URL:"), ' ', h("code", {
    class: "bg-slate-600 mx-2 px-2 py-1 rounded-md"
  }, baseUrl, "/caldav")), h(AddEventModal, {
    isOpen: newEventModal.value.isOpen,
    initialStartDate: newEventModal.value.initialStartDate,
    initiallyAllDay: newEventModal.value.initiallyAllDay,
    calendars: calendars.value,
    onClickSave: onClickSaveNewEvent,
    onClose: onCloseNewEvent
  }), h(ViewEventModal, {
    isOpen: openEventModal.value.isOpen,
    calendar: openEventModal.value.calendar,
    calendarEvent: openEventModal.value.calendarEvent,
    onClickDelete: onClickDeleteEvent,
    onClose: onCloseOpenEvent,
    timezoneId: timezoneId
  }), h(ImportEventsModal, {
    isOpen: openImportModal.value.isOpen,
    calendars: calendars.value,
    onClickImport: onClickChooseImportCalendar,
    onClose: () => {
      openImportModal.value = {
        isOpen: false
      };
    }
  }));
}