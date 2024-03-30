import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { Calendar, CalendarEvent } from '/lib/types.ts';

export type NewCalendarEvent = Pick<
  CalendarEvent,
  'id' | 'calendar_id' | 'title' | 'start_date' | 'end_date' | 'is_all_day'
>;

interface AddEventModalProps {
  isOpen: boolean;
  initialStartDate?: Date;
  initiallyAllDay?: boolean;
  calendars: Pick<Calendar, 'id' | 'name' | 'color'>[];
  onClickSave: (newEvent: NewCalendarEvent) => Promise<void>;
  onClose: () => void;
}

export default function AddEventModal(
  { isOpen, initialStartDate, initiallyAllDay, calendars, onClickSave, onClose }: AddEventModalProps,
) {
  const newEvent = useSignal<NewCalendarEvent | null>(null);

  useEffect(() => {
    if (!isOpen) {
      newEvent.value = null;
    } else {
      const startDate = new Date(initialStartDate || new Date());

      startDate.setMinutes(0);
      startDate.setSeconds(0);
      startDate.setMilliseconds(0);

      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1);

      if (initiallyAllDay) {
        startDate.setHours(9);
        endDate.setHours(18);
      }

      newEvent.value = {
        id: 'new',
        title: '',
        calendar_id: calendars[0]!.id,
        start_date: startDate,
        end_date: endDate,
        is_all_day: initiallyAllDay || false,
      };
    }
  }, [isOpen]);

  return (
    <>
      <section
        class={`fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900 bg-opacity-60`}
      >
      </section>

      <section
        class={`fixed ${
          newEvent.value ? 'block' : 'hidden'
        } z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`}
      >
        <h1 class='text-2xl font-semibold my-5'>New Event</h1>
        <section class='py-5 my-2 border-y border-slate-500'>
          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='event_title'>Title</label>
            <input
              class='input-field'
              type='text'
              name='event_title'
              id='event_title'
              value={newEvent.value?.title || ''}
              onInput={(event) => newEvent.value = { ...newEvent.value!, title: event.currentTarget.value }}
              placeholder='Dentist'
            />
          </fieldset>
          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='event_calendar'>Calendar</label>
            <section class='flex items-center justify-between'>
              <select
                class='input-field mr-2 !w-5/6'
                name='event_calendar'
                id='event_calendar'
                value={newEvent.value?.calendar_id || ''}
                onChange={(event) => newEvent.value = { ...newEvent.value!, calendar_id: event.currentTarget.value }}
              >
                {calendars.map((calendar) => <option value={calendar.id}>{calendar.name}</option>)}
              </select>
              <span
                class={`w-5 h-5 block ${
                  calendars.find((calendar) => calendar.id === newEvent.value?.calendar_id)?.color
                } rounded-full`}
                title={calendars.find((calendar) => calendar.id === newEvent.value?.calendar_id)?.color}
              >
              </span>
            </section>
          </fieldset>
          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='event_start_date'>Start date</label>
            <input
              class='input-field'
              type='datetime-local'
              name='event_start_date'
              id='event_start_date'
              value={newEvent.value?.start_date
                ? new Date(newEvent.value.start_date).toISOString().substring(0, 16)
                : ''}
              onInput={(event) =>
                newEvent.value = { ...newEvent.value!, start_date: new Date(event.currentTarget.value) }}
            />
          </fieldset>
          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='event_end_date'>End date</label>
            <input
              class='input-field'
              type='datetime-local'
              name='event_end_date'
              id='event_end_date'
              value={newEvent.value?.end_date ? new Date(newEvent.value.end_date).toISOString().substring(0, 16) : ''}
              onInput={(event) =>
                newEvent.value = { ...newEvent.value!, end_date: new Date(event.currentTarget.value) }}
            />
          </fieldset>
          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='event_is_all_day'>All-day?</label>
            <input
              type='checkbox'
              name='event_is_all_day'
              id='event_is_all_day'
              value='true'
              checked={newEvent.value?.is_all_day}
              onChange={(event) => newEvent.value = { ...newEvent.value!, is_all_day: event.currentTarget.checked }}
            />
          </fieldset>
        </section>
        <footer class='flex justify-between'>
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            onClick={() => onClickSave(newEvent.value!)}
          >
            Save
          </button>
          <button
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
