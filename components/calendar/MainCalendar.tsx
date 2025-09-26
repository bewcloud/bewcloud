import { useSignal } from '@preact/signals';

import { Calendar, CalendarEvent } from '/lib/models/calendar.ts';
import { capitalizeWord } from '/lib/utils/misc.ts';
import { generateVCalendar } from '/lib/utils/calendar.ts';
import {
  RequestBody as ExportRequestBody,
  ResponseBody as ExportResponseBody,
} from '/routes/api/calendar/export-events.tsx';
import { RequestBody as AddRequestBody, ResponseBody as AddResponseBody } from '/routes/api/calendar/add-event.tsx';
import {
  RequestBody as DeleteRequestBody,
  ResponseBody as DeleteResponseBody,
} from '/routes/api/calendar/delete-event.tsx';
import { RequestBody as ImportRequestBody, ResponseBody as ImportResponseBody } from '/routes/api/calendar/import.tsx';
import CalendarViewDay from './CalendarViewDay.tsx';
import CalendarViewWeek from './CalendarViewWeek.tsx';
import CalendarViewMonth from './CalendarViewMonth.tsx';
import AddEventModal from './AddEventModal.tsx';
import ViewEventModal from './ViewEventModal.tsx';
import SearchEvents from './SearchEvents.tsx';
import ImportEventsModal from './ImportEventsModal.tsx';

interface MainCalendarProps {
  initialCalendars: Calendar[];
  initialCalendarEvents: CalendarEvent[];
  view: 'day' | 'week' | 'month';
  startDate: string;
  baseUrl: string;
  timezoneId: string;
  timezoneUtcOffset: number;
}

export default function MainCalendar(
  { initialCalendars, initialCalendarEvents, view, startDate, baseUrl, timezoneId, timezoneUtcOffset }:
    MainCalendarProps,
) {
  const isAdding = useSignal<boolean>(false);
  const isDeleting = useSignal<boolean>(false);
  const isExporting = useSignal<boolean>(false);
  const isImporting = useSignal<boolean>(false);
  const calendars = useSignal<Calendar[]>(initialCalendars);
  const isViewOptionsDropdownOpen = useSignal<boolean>(false);
  const isImportExportOptionsDropdownOpen = useSignal<boolean>(false);
  const calendarEvents = useSignal<CalendarEvent[]>(initialCalendarEvents);
  const openEventModal = useSignal<
    { isOpen: boolean; calendar?: typeof initialCalendars[number]; calendarEvent?: CalendarEvent }
  >({ isOpen: false });
  const newEventModal = useSignal<{ isOpen: boolean; initialStartDate?: Date; initiallyAllDay?: boolean }>({
    isOpen: false,
  });
  const openImportModal = useSignal<
    { isOpen: boolean }
  >({ isOpen: false });

  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    timeZone: timezoneId, // Calendar dates are parsed without timezone info, so we need to force to a specific one so it's consistent across db, server, and client
  });
  const today = new Date().toISOString().substring(0, 10);

  const visibleCalendars = calendars.value.filter((calendar) => calendar.isVisible);

  function onClickAddEvent(startDate = new Date(), isAllDay = false) {
    if (newEventModal.value.isOpen) {
      newEventModal.value = {
        isOpen: false,
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
      initiallyAllDay: isAllDay,
    };
  }

  async function onClickSaveNewEvent(newEvent: CalendarEvent) {
    if (isAdding.value) {
      return;
    }

    if (!newEvent) {
      return;
    }

    isAdding.value = true;

    try {
      const requestBody: AddRequestBody = {
        calendarIds: visibleCalendars.map((calendar) => calendar.uid!),
        calendarView: view,
        calendarStartDate: startDate,
        calendarId: newEvent.calendarId,
        title: newEvent.title,
        startDate: new Date(newEvent.startDate).toISOString(),
        endDate: new Date(newEvent.endDate).toISOString(),
        isAllDay: newEvent.isAllDay,
      };
      const response = await fetch(`/api/calendar/add-event`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const result = await response.json() as AddResponseBody;

      if (!result.success) {
        throw new Error('Failed to add event!');
      }

      calendarEvents.value = [...result.newCalendarEvents];

      newEventModal.value = {
        isOpen: false,
      };
    } catch (error) {
      console.error(error);
    }

    isAdding.value = false;
  }

  function onCloseNewEvent() {
    newEventModal.value = {
      isOpen: false,
    };
  }

  function toggleImportExportOptionsDropdown() {
    isImportExportOptionsDropdownOpen.value = !isImportExportOptionsDropdownOpen.value;
  }

  function toggleViewOptionsDropdown() {
    isViewOptionsDropdownOpen.value = !isViewOptionsDropdownOpen.value;
  }

  function onClickOpenEvent(calendarEvent: CalendarEvent) {
    if (openEventModal.value.isOpen) {
      openEventModal.value = {
        isOpen: false,
      };
      return;
    }

    const calendar = calendars.value.find((calendar) => calendar.uid === calendarEvent.calendarId)!;

    openEventModal.value = {
      isOpen: true,
      calendar,
      calendarEvent,
    };
  }

  async function onClickDeleteEvent(calendarEventId: string) {
    if (confirm('Are you sure you want to delete this event?')) {
      if (isDeleting.value) {
        return;
      }

      isDeleting.value = true;

      try {
        const requestBody: DeleteRequestBody = {
          calendarIds: visibleCalendars.map((calendar) => calendar.uid!),
          calendarView: view,
          calendarStartDate: startDate,
          calendarEventId,
          calendarId: calendarEvents.value.find((calendarEvent) => calendarEvent.uid === calendarEventId)!.calendarId,
        };
        const response = await fetch(`/api/calendar/delete-event`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });
        const result = await response.json() as DeleteResponseBody;

        if (!result.success) {
          throw new Error('Failed to delete event!');
        }

        calendarEvents.value = [...result.newCalendarEvents];
      } catch (error) {
        console.error(error);
      }

      isDeleting.value = false;

      openEventModal.value = { isOpen: false };
    }
  }

  function onCloseOpenEvent() {
    openEventModal.value = {
      isOpen: false,
    };
  }

  function onClickChangeStartDate(changeTo: 'previous' | 'next' | 'today') {
    const previousDay = new Date(new Date(startDate).setUTCDate(new Date(startDate).getUTCDate() - 1)).toISOString()
      .substring(0, 10);
    const nextDay = new Date(new Date(startDate).setUTCDate(new Date(startDate).getUTCDate() + 1)).toISOString()
      .substring(0, 10);
    const previousWeek = new Date(new Date(startDate).setUTCDate(new Date(startDate).getUTCDate() - 7)).toISOString()
      .substring(0, 10);
    const nextWeek = new Date(new Date(startDate).setUTCDate(new Date(startDate).getUTCDate() + 7)).toISOString()
      .substring(0, 10);
    const previousMonth = new Date(new Date(startDate).setUTCMonth(new Date(startDate).getUTCMonth() - 1)).toISOString()
      .substring(0, 10);
    const nextMonth = new Date(new Date(startDate).setUTCMonth(new Date(startDate).getUTCMonth() + 1)).toISOString()
      .substring(0, 10);

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

  function onClickChangeView(newView: MainCalendarProps['view']) {
    if (view === newView) {
      isViewOptionsDropdownOpen.value = false;
      return;
    }

    window.location.href = `/calendar?view=${newView}&startDate=${startDate}`;
  }

  function onClickImportICS() {
    openImportModal.value = { isOpen: true };
    isImportExportOptionsDropdownOpen.value = false;
  }

  function onClickChooseImportCalendar(calendarId: string) {
    isImportExportOptionsDropdownOpen.value = false;

    if (isImporting.value) {
      return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.click();

    fileInput.onchange = (event) => {
      const files = (event.target as HTMLInputElement)?.files!;
      const file = files[0];

      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = async (fileRead) => {
        const importFileContents = fileRead.target?.result;

        if (!importFileContents || isImporting.value) {
          return;
        }

        isImporting.value = true;

        openImportModal.value = { isOpen: false };

        try {
          const icsToImport = importFileContents!.toString();

          const requestBody: ImportRequestBody = {
            icsToImport,
            calendarIds: visibleCalendars.map((calendar) => calendar.uid!),
            calendarView: view,
            calendarStartDate: startDate,
            calendarId,
          };

          const response = await fetch(`/api/calendar/import`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
          });
          const result = await response.json() as ImportResponseBody;

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

    const fileName = ['calendar-', new Date().toISOString().substring(0, 19).replace(/:/g, '-'), '.ics']
      .join('');

    try {
      const requestBody: ExportRequestBody = { calendarIds: visibleCalendars.map((calendar) => calendar.uid!) };
      const response = await fetch(`/api/calendar/export-events`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const result = await response.json() as ExportResponseBody;

      if (!result.success) {
        throw new Error('Failed to get contact!');
      }

      const exportContents = generateVCalendar([...result.calendarEvents]);

      // Add content-type
      const vCardContent = ['data:text/calendar; charset=utf-8,', encodeURIComponent(exportContents)].join('');

      // Download the file
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

  return (
    <>
      <section class='flex flex-row items-center justify-between mb-4'>
        <section class='relative inline-block text-left mr-2'>
          <section class='flex flex-row items-center justify-start'>
            <a href='/calendars' class='mr-4 whitespace-nowrap'>Manage calendars</a>
            <SearchEvents calendars={visibleCalendars} onClickOpenEvent={onClickOpenEvent} />
          </section>
        </section>

        <section class='flex items-center justify-end'>
          <h3 class='text-base font-semibold text-white whitespace-nowrap mr-2'>
            <time datetime={startDate}>{dateFormat.format(new Date(startDate))}</time>
          </h3>
          <section class='ml-2 relative flex items-center rounded-md bg-slate-700 shadow-sm md:items-stretch'>
            <button
              type='button'
              class='flex h-9 w-12 items-center justify-center rounded-l-md text-white hover:bg-slate-600 focus:relative'
              onClick={() => onClickChangeStartDate('previous')}
            >
              <span class='sr-only'>Previous {view}</span>
              <svg class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                <path
                  fill-rule='evenodd'
                  d='M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z'
                  clip-rule='evenodd'
                />
              </svg>
            </button>
            <button
              type='button'
              class='px-3.5 text-sm font-semibold text-white hover:bg-slate-600 focus:relative'
              onClick={() => onClickChangeStartDate('today')}
            >
              Today
            </button>
            <button
              type='button'
              class='flex h-9 w-12 items-center justify-center rounded-r-md text-white hover:bg-slate-600 pl-1 focus:relative'
              onClick={() => onClickChangeStartDate('next')}
            >
              <span class='sr-only'>Next {view}</span>
              <svg class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                <path
                  fill-rule='evenodd'
                  d='M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z'
                  clip-rule='evenodd'
                />
              </svg>
            </button>
          </section>
          <section class='relative inline-block text-left ml-2'>
            <div>
              <button
                type='button'
                class='inline-flex w-full justify-center gap-x-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600'
                id='view-button'
                aria-expanded='true'
                aria-haspopup='true'
                onClick={() => toggleViewOptionsDropdown()}
              >
                {capitalizeWord(view)}
                <svg class='-mr-1 h-5 w-5 text-white' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                  <path
                    fill-rule='evenodd'
                    d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'
                    clip-rule='evenodd'
                  />
                </svg>
              </button>
            </div>

            <div
              class={`absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${
                !isViewOptionsDropdownOpen.value ? 'hidden' : ''
              }`}
              role='menu'
              aria-orientation='vertical'
              aria-labelledby='view-button'
              tabindex={-1}
            >
              <div class='py-1'>
                <button
                  type='button'
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600 ${
                    view === 'day' ? 'font-semibold' : ''
                  }`}
                  onClick={() => onClickChangeView('day')}
                >
                  Day
                </button>
                <button
                  type='button'
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600 ${
                    view === 'week' ? 'font-semibold' : ''
                  }`}
                  onClick={() => onClickChangeView('week')}
                >
                  Week
                </button>
                <button
                  type='button'
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600 ${
                    view === 'month' ? 'font-semibold' : ''
                  }`}
                  onClick={() => onClickChangeView('month')}
                >
                  Month
                </button>
              </div>
            </div>
          </section>
          <section class='relative inline-block text-left ml-2'>
            <div>
              <button
                type='button'
                class='inline-flex w-full justify-center gap-x-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600'
                id='import-export-button'
                aria-expanded='true'
                aria-haspopup='true'
                onClick={() => toggleImportExportOptionsDropdown()}
              >
                ICS
                <svg class='-mr-1 h-5 w-5 text-slate-400' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                  <path
                    fill-rule='evenodd'
                    d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'
                    clip-rule='evenodd'
                  />
                </svg>
              </button>
            </div>

            <div
              class={`absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${
                !isImportExportOptionsDropdownOpen.value ? 'hidden' : ''
              }`}
              role='menu'
              aria-orientation='vertical'
              aria-labelledby='import-export-button'
              tabindex={-1}
            >
              <div class='py-1'>
                <button
                  type='button'
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickImportICS()}
                >
                  Import ICS
                </button>
                <button
                  type='button'
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickExportICS()}
                >
                  Export ICS
                </button>
              </div>
            </div>
          </section>
          <button
            class='inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2'
            type='button'
            title='Add new event'
            onClick={() => onClickAddEvent()}
          >
            <img
              src='/images/add.svg'
              alt='Add new event'
              class={`white ${isAdding.value ? 'animate-spin' : ''}`}
              width={20}
              height={20}
            />
          </button>
        </section>
      </section>

      <section class='mx-auto max-w-7xl my-8'>
        {view === 'day'
          ? (
            <CalendarViewDay
              startDate={new Date(startDate)}
              visibleCalendars={visibleCalendars}
              calendarEvents={calendarEvents.value}
              onClickAddEvent={onClickAddEvent}
              onClickOpenEvent={onClickOpenEvent}
              timezoneId={timezoneId}
            />
          )
          : null}
        {view === 'week'
          ? (
            <CalendarViewWeek
              startDate={new Date(startDate)}
              visibleCalendars={visibleCalendars}
              calendarEvents={calendarEvents.value}
              onClickAddEvent={onClickAddEvent}
              onClickOpenEvent={onClickOpenEvent}
              timezoneId={timezoneId}
            />
          )
          : null}
        {view === 'month'
          ? (
            <CalendarViewMonth
              startDate={new Date(startDate)}
              visibleCalendars={visibleCalendars}
              calendarEvents={calendarEvents.value}
              onClickAddEvent={onClickAddEvent}
              onClickOpenEvent={onClickOpenEvent}
              timezoneId={timezoneId}
            />
          )
          : null}

        <span
          class={`flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`}
        >
          {isDeleting.value
            ? (
              <>
                <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Deleting...
              </>
            )
            : null}
          {isExporting.value
            ? (
              <>
                <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Exporting...
              </>
            )
            : null}
          {isImporting.value
            ? (
              <>
                <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Importing...
              </>
            )
            : null}
          {!isDeleting.value && !isExporting.value && !isImporting.value ? <>&nbsp;</> : null}
        </span>
      </section>

      <section class='flex flex-row items-center justify-start my-12'>
        <span class='font-semibold'>CalDav URL:</span>{' '}
        <code class='bg-slate-600 mx-2 px-2 py-1 rounded-md'>{baseUrl}/caldav</code>
      </section>

      <AddEventModal
        isOpen={newEventModal.value.isOpen}
        initialStartDate={newEventModal.value.initialStartDate}
        initiallyAllDay={newEventModal.value.initiallyAllDay}
        calendars={calendars.value}
        onClickSave={onClickSaveNewEvent}
        onClose={onCloseNewEvent}
      />

      <ViewEventModal
        isOpen={openEventModal.value.isOpen}
        calendar={openEventModal.value.calendar!}
        calendarEvent={openEventModal.value.calendarEvent!}
        onClickDelete={onClickDeleteEvent}
        onClose={onCloseOpenEvent}
        timezoneId={timezoneId}
      />

      <ImportEventsModal
        isOpen={openImportModal.value.isOpen}
        calendars={calendars.value}
        onClickImport={onClickChooseImportCalendar}
        onClose={() => {
          openImportModal.value = { isOpen: false };
        }}
      />
    </>
  );
}
