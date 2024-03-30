import { useSignal } from '@preact/signals';

import { Calendar, CalendarEvent } from '/lib/types.ts';
import { capitalizeWord, convertObjectToFormData } from '/lib/utils/misc.ts';
import { FormField, generateFieldHtml } from '/lib/form-utils.tsx';
import {
  RequestBody as DeleteRequestBody,
  ResponseBody as DeleteResponseBody,
} from '/routes/api/calendar/delete-event.tsx';

interface ViewCalendarEventProps {
  initialCalendarEvent: CalendarEvent;
  calendars: Calendar[];
  formData: Record<string, any>;
  error?: string;
  notice?: string;
}

export function formFields(calendarEvent: CalendarEvent, calendars: Calendar[]) {
  const fields: FormField[] = [
    {
      name: 'title',
      label: 'Title',
      type: 'text',
      placeholder: 'Dentis',
      value: calendarEvent.title,
      required: true,
    },
    {
      name: 'calendar_id',
      label: 'Calendar',
      type: 'select',
      value: calendarEvent.calendar_id,
      options: calendars.map((calendar) => ({ label: calendar.name, value: calendar.id })),
      required: true,
    },
    {
      name: 'start_date',
      label: 'Start date',
      type: 'datetime-local',
      value: new Date(calendarEvent.start_date).toISOString().substring(0, 16),
      required: true,
    },
    {
      name: 'end_date',
      label: 'End date',
      type: 'datetime-local',
      value: new Date(calendarEvent.end_date).toISOString().substring(0, 16),
      required: true,
    },
    {
      name: 'is_all_day',
      label: 'All-day?',
      type: 'checkbox',
      placeholder: 'YYYYMMDD',
      value: 'true',
      required: false,
      checked: calendarEvent.is_all_day,
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      value: calendarEvent.status,
      options: (['scheduled', 'pending', 'canceled'] as CalendarEvent['status'][]).map((status) => ({
        label: capitalizeWord(status),
        value: status,
      })),
      required: true,
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Just a regular check-up.',
      value: calendarEvent.extra.description,
      required: false,
    },
    {
      name: 'url',
      label: 'URL',
      type: 'url',
      placeholder: 'https://example.com',
      value: calendarEvent.extra.url,
      required: false,
    },
    {
      name: 'location',
      label: 'Location',
      type: 'text',
      placeholder: 'Birmingham, UK',
      value: calendarEvent.extra.location,
      required: false,
    },
    {
      name: 'transparency',
      label: 'Transparency',
      type: 'select',
      value: calendarEvent.extra.transparency,
      options: (['default', 'opaque', 'transparent'] as CalendarEvent['extra']['transparency'][]).map((
        transparency,
      ) => ({
        label: capitalizeWord(transparency),
        value: transparency,
      })),
      required: true,
    },
    // TODO: More fields, attendees, recurrence
  ];

  return fields;
}

export default function viewCalendarEvent(
  { initialCalendarEvent, calendars, formData: formDataObject, error, notice }: ViewCalendarEventProps,
) {
  const isDeleting = useSignal<boolean>(false);
  const calendarEvent = useSignal<CalendarEvent>(initialCalendarEvent);

  const formData = convertObjectToFormData(formDataObject);

  async function onClickDeleteEvent() {
    if (confirm('Are you sure you want to delete this event?')) {
      if (isDeleting.value) {
        return;
      }

      isDeleting.value = true;

      try {
        const requestBody: DeleteRequestBody = {
          calendarIds: calendars.map((calendar) => calendar.id),
          calendarView: 'day',
          calendarStartDate: new Date().toISOString().substring(0, 10),
          calendarEventId: calendarEvent.value.id,
          calendarId: calendarEvent.value.calendar_id,
        };
        const response = await fetch(`/api/calendar/delete-event`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });
        const result = await response.json() as DeleteResponseBody;

        if (!result.success) {
          throw new Error('Failed to delete event!');
        }

        window.location.href = '/calendar';
      } catch (error) {
        console.error(error);
      }

      isDeleting.value = false;
    }
  }

  return (
    <>
      <section class='flex flex-row items-center justify-between mb-4'>
        <a href='/calendar' class='mr-2'>View calendar</a>
        <section class='flex items-center'>
          <button
            class='inline-block justify-center gap-x-1.5 rounded-md bg-red-800 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-600 ml-2'
            type='button'
            title='Delete event'
            onClick={() => onClickDeleteEvent()}
          >
            <img
              src='/images/delete.svg'
              alt='Delete event'
              class={`white ${isDeleting.value ? 'animate-spin' : ''}`}
              width={20}
              height={20}
            />
          </button>
        </section>
      </section>

      <section class='mx-auto max-w-7xl my-8'>
        {error
          ? (
            <section class='notification-error'>
              <h3>Failed to update!</h3>
              <p>{error}</p>
            </section>
          )
          : null}
        {notice
          ? (
            <section class='notification-success'>
              <h3>Success!</h3>
              <p>{notice}</p>
            </section>
          )
          : null}

        <form method='POST' class='mb-12'>
          {formFields(calendarEvent.peek(), calendars).map((field) => generateFieldHtml(field, formData))}

          <section class='flex justify-end mt-8 mb-4'>
            <button class='button' type='submit'>Update event</button>
          </section>
        </form>

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
          {!isDeleting.value ? <>&nbsp;</> : null}
        </span>
      </section>
    </>
  );
}
