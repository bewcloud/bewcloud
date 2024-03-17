import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { Calendar, CalendarEvent } from '/lib/types.ts';
import { baseUrl, capitalizeWord } from '/lib/utils.ts';
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

  const dateFormat = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'long' });

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
    }
  }

  function onClickChangeStartDate(changeTo: 'previous' | 'next' | 'today') {
    const today = new Date().toISOString().substring(0, 10);
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
        <section>
          <section class='shadow-md lg:flex lg:flex-auto lg:flex-col rounded-md'>
            <div class='grid grid-cols-7 gap-px border-b border-slate-500 bg-slate-700 text-center text-xs font-semibold text-white lg:flex-none rounded-t-md'>
              <div class='flex justify-center bg-gray-900 py-2 rounded-tl-md'>
                <span>M</span>
                <span class='sr-only sm:not-sr-only'>on</span>
              </div>
              <div class='flex justify-center bg-gray-900 py-2'>
                <span>T</span>
                <span class='sr-only sm:not-sr-only'>ue</span>
              </div>
              <div class='flex justify-center bg-gray-900 py-2'>
                <span>W</span>
                <span class='sr-only sm:not-sr-only'>ed</span>
              </div>
              <div class='flex justify-center bg-gray-900 py-2'>
                <span>T</span>
                <span class='sr-only sm:not-sr-only'>hu</span>
              </div>
              <div class='flex justify-center bg-gray-900 py-2'>
                <span>F</span>
                <span class='sr-only sm:not-sr-only'>ri</span>
              </div>
              <div class='flex justify-center bg-gray-900 py-2'>
                <span>S</span>
                <span class='sr-only sm:not-sr-only'>at</span>
              </div>
              <div class='flex justify-center bg-gray-900 py-2 rounded-tr-md'>
                <span>S</span>
                <span class='sr-only sm:not-sr-only'>un</span>
              </div>
            </div>
            <div class='flex bg-slate-500 text-xs leading-6 text-white lg:flex-auto rounded-b-md'>
              <div class='w-full grid lg:grid-cols-7 lg:grid-rows-5 lg:gap-px rounded-b-md'>
                <div class='relative bg-slate-700 px-3 py-2 text-slate-100'>
                  <time datetime='2024-02-28'>26</time>
                </div>
                <div class='relative bg-slate-700 px-3 py-2 text-slate-100'>
                  <time datetime='2024-02-28'>27</time>
                </div>
                <div class='relative bg-slate-700 px-3 py-2 text-slate-100'>
                  <time datetime='2024-02-28'>28</time>
                </div>
                <div class='relative bg-slate-700 px-3 py-2 text-slate-100'>
                  <time datetime='2024-02-29'>29</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-01'>1</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-02'>2</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-03'>3</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-04'>4</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-05'>5</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-06'>6</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-07'>7</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-08'>8</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-09'>9</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-10'>10</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-11'>11</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-12'>12</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-13'>13</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-14'>14</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-15'>15</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-16'>16</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time
                    datetime='2024-03-17'
                    class='flex h-6 w-6 items-center justify-center rounded-full bg-[#51A4FB] font-semibold'
                  >
                    17
                  </time>
                  <ol class='mt-2'>
                    <li class='mb-1'>
                      <a
                        href='#'
                        class='flex bg-purple-600 px-2 py-0 rounded-md hover:no-underline hover:bg-purple-500'
                      >
                        <time
                          datetime='2024-03-17T14:00'
                          class='mr-2 flex-none text-slate-100 block'
                        >
                          14:00
                        </time>
                        <p class='flex-auto truncate font-medium text-white'>
                          Dentist
                        </p>
                      </a>
                    </li>
                    <li class='mb-1'>
                      <a
                        href='#'
                        class='flex bg-purple-600 px-2 py-0 rounded-md hover:no-underline hover:bg-purple-500'
                      >
                        <time
                          datetime='2024-03-17T16:30'
                          class='mr-2 flex-none text-slate-100 block'
                        >
                          16:30
                        </time>
                        <p class='flex-auto truncate font-medium text-white'>
                          Dermatologist
                        </p>
                      </a>
                    </li>
                    <li class='mb-1'>
                      <a
                        href='#'
                        class='flex bg-purple-600 px-2 py-0 rounded-md hover:no-underline hover:bg-purple-500'
                      >
                        <p class='flex-auto truncate font-medium text-white'>
                          ...3 more events
                        </p>
                      </a>
                    </li>
                  </ol>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-18'>18</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-19'>19</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-20'>20</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-21'>21</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-22'>22</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-23'>23</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-24'>24</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-25'>25</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-26'>26</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-27'>27</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-28'>28</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-29'>29</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2'>
                  <time datetime='2024-03-30'>30</time>
                </div>
                <div class='relative bg-slate-600 px-3 py-2 rounded-br-md'>
                  <time datetime='2024-03-31'>31</time>
                </div>
              </div>
            </div>
          </section>
        </section>

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
    </>
  );
}
