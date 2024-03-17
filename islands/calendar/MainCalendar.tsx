import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { Calendar, CalendarEvent } from '/lib/types.ts';
import { baseUrl, capitalizeWord, getWeeksForMonth } from '/lib/utils.ts';
// import { RequestBody as GetRequestBody, ResponseBody as GetResponseBody } from '/routes/api/contacts/get.tsx';
// import { RequestBody as AddRequestBody, ResponseBody as AddResponseBody } from '/routes/api/contacts/add.tsx';
// import { RequestBody as DeleteRequestBody, ResponseBody as DeleteResponseBody } from '/routes/api/contacts/delete.tsx';
// import { RequestBody as ImportRequestBody, ResponseBody as ImportResponseBody } from '/routes/api/contacts/import.tsx';

interface MainCalendarProps {
  initialCalendars: Pick<Calendar, 'id' | 'name' | 'color' | 'is_visible'>[];
  initialCalendarEvents: CalendarEvent[];
  view: 'day' | 'week' | 'month';
  startDate: string;
}

export default function MainCalendar({ initialCalendars, initialCalendarEvents, view, startDate }: MainCalendarProps) {
  const isAdding = useSignal<boolean>(false);
  const isDeleting = useSignal<boolean>(false);
  const isExporting = useSignal<boolean>(false);
  const isImporting = useSignal<boolean>(false);
  const isSearching = useSignal<boolean>(false);
  const calendars = useSignal<Pick<Calendar, 'id' | 'name' | 'color' | 'is_visible'>[]>(initialCalendars);
  const isViewOptionsDropdownOpen = useSignal<boolean>(false);
  const isImportExportOptionsDropdownOpen = useSignal<boolean>(false);
  const calendarEvents = useSignal<CalendarEvent[]>(initialCalendarEvents);
  const searchTimeout = useSignal<ReturnType<typeof setTimeout>>(0);
  const openEvent = useSignal<CalendarEvent | null>(null);

  const dateFormat = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'long' });
  const hourFormat = new Intl.DateTimeFormat('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const dayFormat = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const allDayEventDateFormat = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const today = new Date().toISOString().substring(0, 10);

  function onClickAddEvent() {
    if (isAdding.value) {
      return;
    }

    const title = (prompt(`What's the **title** for the new event?`) || '').trim();

    if (!title) {
      alert('A title is required for a new event!');
      return;
    }

    const startDate =
      (prompt(`What's the **start date** for the new event (YYYY-MM-DD)?`, new Date().toISOString().substring(0, 10)) ||
        '').trim();
    const startHour =
      (prompt(`What's the **start hour** for the new event (HH:mm)?`, new Date().toISOString().substring(11, 5)) || '')
        .trim();

    if (!startDate || !startHour) {
      alert('A start date and hour are required for a new event!');
      return;
    }

    isAdding.value = true;

    // try {
    //   const requestBody: AddRequestBody = { title, startDate, startHour };
    //   const response = await fetch(`/api/calendar/add-event`, {
    //     method: 'POST',
    //     body: JSON.stringify(requestBody),
    //   });
    //   const result = await response.json() as AddResponseBody;

    //   if (!result.success) {
    //     throw new Error('Failed to add contact!');
    //   }

    //   contacts.value = [...result.contacts];
    // } catch (error) {
    //   console.error(error);
    // }

    isAdding.value = false;
  }

  function toggleImportExportOptionsDropdown() {
    isImportExportOptionsDropdownOpen.value = !isImportExportOptionsDropdownOpen.value;
  }

  function toggleViewOptionsDropdown() {
    isViewOptionsDropdownOpen.value = !isViewOptionsDropdownOpen.value;
  }

  function onClickDeleteEvent(calendarEventId: string) {
    if (confirm('Are you sure you want to delete this event?')) {
      if (isDeleting.value) {
        return;
      }

      isDeleting.value = true;

      // try {
      //   const requestBody: DeleteRequestBody = { calendarEventId, view, startDay };
      //   const response = await fetch(`/api/calendar/delete-event`, {
      //     method: 'POST',
      //     body: JSON.stringify(requestBody),
      //   });
      //   const result = await response.json() as DeleteResponseBody;

      //   if (!result.success) {
      //     throw new Error('Failed to delete event!');
      //   }

      //   contacts.value = [...result.contacts];
      // } catch (error) {
      //   console.error(error);
      // }

      isDeleting.value = false;

      openEvent.value = null;
    }
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
      reader.onload = (fileRead) => {
        const importFileContents = fileRead.target?.result;

        if (!importFileContents || isImporting.value) {
          return;
        }

        isImporting.value = true;

        // try {
        //   const partialContacts = parseVCardFromTextContents(importFileContents!.toString());

        //   const requestBody: ImportRequestBody = { partialContacts, page };
        //   const response = await fetch(`/api/calendar/import`, {
        //     method: 'POST',
        //     body: JSON.stringify(requestBody),
        //   });
        //   const result = await response.json() as ImportResponseBody;

        //   if (!result.success) {
        //     throw new Error('Failed to import contact!');
        //   }

        //   contacts.value = [...result.contacts];
        // } catch (error) {
        //   console.error(error);
        // }

        isImporting.value = false;
      };

      reader.readAsText(file, 'UTF-8');
    };
  }

  function onClickExportICS() {
    isImportExportOptionsDropdownOpen.value = false;

    if (isExporting.value) {
      return;
    }

    isExporting.value = true;

    // const fileName = ['calendars-', new Date().toISOString().substring(0, 19).replace(/:/g, '-'), '.ics']
    //   .join('');

    // try {
    //   const requestBody: GetRequestBody = {};
    //   const response = await fetch(`/api/calendar/get`, {
    //     method: 'POST',
    //     body: JSON.stringify(requestBody),
    //   });
    //   const result = await response.json() as GetResponseBody;

    //   if (!result.success) {
    //     throw new Error('Failed to get contact!');
    //   }

    //   const exportContents = formatContactToVCard([...result.contacts]);

    //   // Add content-type
    //   const vCardContent = ['data:text/vcard; charset=utf-8,', encodeURIComponent(exportContents)].join('');

    //   // Download the file
    //   const data = vCardContent;
    //   const link = document.createElement('a');
    //   link.setAttribute('href', data);
    //   link.setAttribute('download', fileName);
    //   link.click();
    //   link.remove();
    // } catch (error) {
    //   console.error(error);
    // }

    isExporting.value = false;
  }

  function searchEvents(searchTerms: string) {
    if (searchTimeout.value) {
      clearTimeout(searchTimeout.value);
    }

    searchTimeout.value = setTimeout(async () => {
      isSearching.value = true;

      // TODO: Remove this
      await new Promise((resolve) => setTimeout(() => resolve(true), 1000));

      // try {
      //   const requestBody: RequestBody = { search: searchTerms };
      //   const response = await fetch(`/api/calendar/search-events`, {
      //     method: 'POST',
      //     body: JSON.stringify(requestBody),
      //   });
      //   const result = await response.json() as ResponseBody;

      //   if (!result.success) {
      //     throw new Error('Failed to search events!');
      //   }
      // } catch (error) {
      //   console.error(error);
      // }

      isSearching.value = false;
    }, 500);
  }

  useEffect(() => {
    return () => {
      if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
      }
    };
  }, []);

  const visibleCalendars = calendars.value.filter((calendar) => calendar.is_visible);

  const visibleCalendarEvents = calendarEvents.value;

  // TODO: Send in / consider user timezone
  const weeks = view === 'month' ? getWeeksForMonth(new Date(startDate)) : [];
  const hours: { date: Date; isCurrentHour: boolean }[] = view === 'day'
    ? Array.from({ length: 24 }).map((_, index) => {
      const hourNumber = index;

      const date = new Date(startDate);
      date.setHours(hourNumber);

      const shortIsoDate = date.toISOString().substring(0, 10);

      const isCurrentHour = shortIsoDate === today && new Date().getHours() === hourNumber;

      return {
        date,
        isCurrentHour,
      };
    })
    : [];

  // TODO: days with hours

  return (
    <>
      <section class='flex flex-row items-center justify-between mb-4'>
        <section class='relative inline-block text-left mr-2'>
          <section class='flex flex-row items-center justify-start'>
            <a href='/calendar/manage' class='mr-4 whitespace-nowrap'>Manage calendars</a>
            <input
              class='input-field w-72 mr-2'
              type='search'
              name='search'
              placeholder='Search events...'
              onInput={(event) => searchEvents(event.currentTarget.value)}
            />
            {isSearching.value ? <img src='/images/loading.svg' class='white mr-2' width={18} height={18} /> : null}
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
              class={`absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black ring-opacity-15 focus:outline-none ${
                !isViewOptionsDropdownOpen.value ? 'hidden' : ''
              }`}
              role='menu'
              aria-orientation='vertical'
              aria-labelledby='view-button'
              tabindex={-1}
            >
              <div class='py-1'>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600 ${
                    view === 'day' ? 'font-semibold' : ''
                  }`}
                  onClick={() => onClickChangeView('day')}
                >
                  Day
                </button>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600 ${
                    view === 'week' ? 'font-semibold' : ''
                  }`}
                  onClick={() => onClickChangeView('week')}
                >
                  Week
                </button>
                <button
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
              class={`absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black ring-opacity-15 focus:outline-none ${
                !isImportExportOptionsDropdownOpen.value ? 'hidden' : ''
              }`}
              role='menu'
              aria-orientation='vertical'
              aria-labelledby='import-export-button'
              tabindex={-1}
            >
              <div class='py-1'>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickImportICS()}
                >
                  Import ICS
                </button>
                <button
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
            <section class='shadow-md lg:flex lg:flex-auto lg:flex-col rounded-md'>
              <section class='border-b border-slate-500 bg-slate-700 text-center text-base font-semibold text-white lg:flex-none rounded-t-md'>
                <div class='flex justify-center bg-gray-900 py-2 rounded-t-md'>
                  <span>{dayFormat.format(new Date(startDate))}</span>
                </div>
              </section>
              <section class='flex bg-slate-500 text-sm text-white lg:flex-auto rounded-b-md'>
                <section class='w-full rounded-b-md'>
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

                    const hourEvents = calendarEvents.value.filter((calendarEvent) => {
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
                        class={`relative ${hour.isCurrentHour ? 'bg-slate-600' : 'bg-slate-700'} min-h-16 px-3 py-2 ${
                          hour.isCurrentHour ? '' : 'text-slate-100'
                        } ${isLastHour ? 'rounded-b-md' : ''} border-b border-b-slate-600`}
                      >
                        <time datetime={startHourDate.toISOString()}>
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
                                    onClick={() => openEvent.value = hourEvent}
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
          )
          : null}
        {view === 'week'
          ? (
            <section>
              TODO: Build week view
            </section>
          )
          : null}
        {view === 'month'
          ? (
            <section class='shadow-md lg:flex lg:flex-auto lg:flex-col rounded-md'>
              <section class='grid grid-cols-7 gap-px border-b border-slate-500 bg-slate-700 text-center text-xs font-semibold text-white lg:flex-none rounded-t-md'>
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
              <section class='flex bg-slate-500 text-xs text-white lg:flex-auto rounded-b-md'>
                <section class='w-full grid lg:grid-cols-7 lg:grid-rows-5 lg:gap-px rounded-b-md'>
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

                      const dayEvents = calendarEvents.value.filter((calendarEvent) => {
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
                            class={`${
                              isToday
                                ? 'flex h-6 w-6 items-center justify-center rounded-full bg-[#51A4FB] font-semibold'
                                : ''
                            }`}
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
                                      onClick={() => openEvent.value = dayEvent}
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
        <span class='font-semibold'>CalDAV URLs:</span>{' '}
        <code class='bg-slate-600 mx-2 px-2 py-1 rounded-md'>{baseUrl}/dav/principals/</code>{' '}
        <code class='bg-slate-600 mx-2 px-2 py-1 rounded-md'>{baseUrl}/dav/calendars/</code>
      </section>

      <section
        class={`fixed ${openEvent.value ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900 bg-opacity-60`}
      >
      </section>

      <section
        class={`fixed ${
          openEvent.value ? 'block' : 'hidden'
        } z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 space-y-5 drop-shadow-lg`}
      >
        <h1 class='text-2xl font-semibold'>{openEvent.value?.title || ''}</h1>
        <header class='py-5 border-t border-b border-slate-500 font-semibold flex justify-between'>
          <span>
            {openEvent.value?.start_date ? allDayEventDateFormat.format(new Date(openEvent.value.start_date)) : ''}
          </span>
          {openEvent.value?.is_all_day ? <span>All-day</span> : (
            <span>
              {openEvent.value?.start_date ? hourFormat.format(new Date(openEvent.value.start_date)) : ''} -{' '}
              {openEvent.value?.end_date ? hourFormat.format(new Date(openEvent.value.end_date)) : ''}
            </span>
          )}
        </header>
        {openEvent.value?.extra.description
          ? (
            <section class='py-5 border-b border-slate-500'>
              <p>{openEvent.value.extra.description}</p>
            </section>
          )
          : null}
        <section class='py-5 border-b border-slate-500'>
          <p>TODO: location, calendar, recurrence, reminders</p>
        </section>
        <footer class='flex justify-between'>
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-red-600 text-white cursor-pointer rounded-md'
            onClick={() => onClickDeleteEvent(openEvent.value?.id || '')}
          >
            Delete
          </button>
          <a
            href={`/calendar/events/${openEvent.value?.id}`}
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
          >
            Edit
          </a>
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => openEvent.value = null}
          >
            Close
          </button>
        </footer>
      </section>
    </>
  );
}
