import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { Calendar } from '/lib/models/calendar.ts';

interface ImportEventsModalProps {
  isOpen: boolean;
  calendars: Calendar[];
  onClickImport: (calendarId: string) => void;
  onClose: () => void;
}

export default function ImportEventsModal(
  { isOpen, calendars, onClickImport, onClose }: ImportEventsModalProps,
) {
  const newCalendarId = useSignal<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      newCalendarId.value = null;
    } else {
      newCalendarId.value = calendars[0]!.uid!;
    }
  }, [isOpen]);

  return (
    <>
      <section
        class={`fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`}
      >
      </section>

      <section
        class={`fixed ${
          newCalendarId.value ? 'block' : 'hidden'
        } z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`}
      >
        <h1 class='text-2xl font-semibold my-5'>Import Events</h1>
        <section class='py-5 my-2 border-y border-slate-500'>
          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='event_calendar'>Calendar</label>
            <section class='flex items-center justify-between'>
              <select
                class='input-field mr-2 w-5/6!'
                name='event_calendar'
                id='event_calendar'
                value={newCalendarId.value || ''}
                onChange={(event) => {
                  newCalendarId.value = event.currentTarget.value;
                }}
              >
                {calendars.map((calendar) => (
                  <option key={calendar.uid} value={calendar.uid}>{calendar.displayName}</option>
                ))}
              </select>
              <span
                class={`w-5 h-5 block rounded-full`}
                style={{
                  backgroundColor: calendars.find((calendar) => calendar.uid === newCalendarId.value)?.calendarColor,
                }}
                title={calendars.find((calendar) => calendar.uid === newCalendarId.value)?.calendarColor}
              >
              </span>
            </section>
          </fieldset>
        </section>
        <footer class='flex justify-between'>
          <button
            type='button'
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => onClickImport(newCalendarId.value!)}
          >
            Choose File
          </button>
          <button
            type='button'
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => onClose()}
          >
            Close
          </button>
        </footer>
      </section>
    </>
  );
}
