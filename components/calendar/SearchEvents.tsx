import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { Calendar, CalendarEvent } from '/lib/types.ts';
import { RequestBody, ResponseBody } from '/routes/api/calendar/search-events.tsx';
interface SearchEventsProps {
  calendars: Pick<Calendar, 'id' | 'name' | 'color' | 'is_visible'>[];
  onClickOpenEvent: (calendarEvent: CalendarEvent) => void;
}

export default function SearchEvents({ calendars, onClickOpenEvent }: SearchEventsProps) {
  const isSearching = useSignal<boolean>(false);
  const areResultsVisible = useSignal<boolean>(false);
  const calendarEvents = useSignal<CalendarEvent[]>([]);
  const searchTimeout = useSignal<ReturnType<typeof setTimeout>>(0);
  const closeTimeout = useSignal<ReturnType<typeof setTimeout>>(0);

  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const calendarIds = calendars.map((calendar) => calendar.id);

  function searchEvents(searchTerm: string) {
    if (searchTimeout.value) {
      clearTimeout(searchTimeout.value);
    }

    if (searchTerm.trim().length < 2) {
      return;
    }

    areResultsVisible.value = false;

    searchTimeout.value = setTimeout(async () => {
      isSearching.value = true;

      try {
        const requestBody: RequestBody = { calendarIds, searchTerm };
        const response = await fetch(`/api/calendar/search-events`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });
        const result = await response.json() as ResponseBody;

        if (!result.success) {
          throw new Error('Failed to search events!');
        }

        calendarEvents.value = result.matchingCalendarEvents;

        if (calendarEvents.value.length > 0) {
          areResultsVisible.value = true;
        }
      } catch (error) {
        console.error(error);
      }

      isSearching.value = false;
    }, 500);
  }

  function onFocus() {
    if (calendarEvents.value.length > 0) {
      areResultsVisible.value = true;
    }
  }

  function onBlur() {
    if (closeTimeout.value) {
      clearTimeout(closeTimeout.value);
    }

    closeTimeout.value = setTimeout(() => {
      areResultsVisible.value = false;
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
      }

      if (closeTimeout.value) {
        clearTimeout(closeTimeout.value);
      }
    };
  }, []);

  return (
    <>
      <input
        class='input-field w-72 mr-2'
        type='search'
        name='search'
        placeholder='Search events...'
        onInput={(event) => searchEvents(event.currentTarget.value)}
        onFocus={() => onFocus()}
        onBlur={() => onBlur()}
      />
      {isSearching.value ? <img src='/images/loading.svg' class='white mr-2' width={18} height={18} /> : null}
      {areResultsVisible.value
        ? (
          <section class='relative inline-block text-left ml-2 text-xs'>
            <section
              class={`absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black ring-opacity-15 focus:outline-none`}
              role='menu'
              aria-orientation='vertical'
              aria-labelledby='view-button'
              tabindex={-1}
            >
              <section class='py-1'>
                <ol class='mt-2'>
                  {calendarEvents.value.map((calendarEvent) => (
                    <li class='mb-1'>
                      <a
                        href='javascript:void(0);'
                        class={`block px-2 py-2 hover:no-underline hover:opacity-60 ${
                          calendars.find((calendar) => calendar.id === calendarEvent.calendar_id)
                            ?.color || 'bg-gray-700'
                        }`}
                        onClick={() => onClickOpenEvent(calendarEvent)}
                      >
                        <time
                          datetime={new Date(calendarEvent.start_date).toISOString()}
                          class='mr-2 flex-none text-slate-100 block'
                        >
                          {dateFormat.format(new Date(calendarEvent.start_date))}
                        </time>
                        <p class='flex-auto truncate font-medium text-white'>
                          {calendarEvent.title}
                        </p>
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            </section>
          </section>
        )
        : null}
    </>
  );
}
