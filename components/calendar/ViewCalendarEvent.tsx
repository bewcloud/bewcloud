import { useSignal } from '@preact/signals';

import { Calendar, CalendarEvent } from '/lib/models/calendar.ts';
import { capitalizeWord, convertObjectToFormData } from '/public/ts/utils/misc.ts';
import { FormField, generateFieldHtml } from '/public/ts/utils/form.ts';
import {
  RequestBody as DeleteRequestBody,
  ResponseBody as DeleteResponseBody,
} from '/pages/api/calendar/delete-event.ts';

interface ViewCalendarEventProps {
  initialCalendarEvent: CalendarEvent;
  calendars: Calendar[];
  formData: Record<string, any>;
  error?: string;
  notice?: string;
}

export function formFields(calendarEvent: CalendarEvent, calendars: Calendar[], updateType: 'raw' | 'ui') {
  const fields: FormField[] = [
    {
      name: 'update-type',
      label: 'Update type',
      type: 'hidden',
      value: updateType,
      readOnly: true,
    },
  ];

  if (updateType === 'ui') {
    fields.push({
      name: 'title',
      label: 'Title',
      type: 'text',
      placeholder: 'Dentis',
      value: calendarEvent.title,
      required: true,
    }, {
      name: 'calendarId',
      label: 'Calendar',
      type: 'select',
      value: calendarEvent.calendarId,
      options: calendars.map((calendar) => ({ label: calendar.displayName!, value: calendar.uid! })),
      required: true,
      description: 'Cannot be changed after the event has been created.',
    }, {
      name: 'startDate',
      label: 'Start date',
      type: 'datetime-local',
      value: new Date(calendarEvent.startDate).toISOString().substring(0, 16),
      required: true,
      description: 'Dates are set in the default calendar timezone, controlled by Radicale.',
    }, {
      name: 'endDate',
      label: 'End date',
      type: 'datetime-local',
      value: new Date(calendarEvent.endDate).toISOString().substring(0, 16),
      required: true,
      description: 'Dates are set in the default calendar timezone, controlled by Radicale.',
    }, {
      name: 'isAllDay',
      label: 'All-day?',
      type: 'checkbox',
      placeholder: 'YYYYMMDD',
      value: 'true',
      required: false,
      checked: calendarEvent.isAllDay,
    }, {
      name: 'status',
      label: 'Status',
      type: 'select',
      value: calendarEvent.status,
      options: (['scheduled', 'pending', 'canceled'] as CalendarEvent['status'][]).map((status) => ({
        label: capitalizeWord(status),
        value: status,
      })),
      required: true,
    }, {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Just a regular check-up.',
      value: calendarEvent.description,
      required: false,
    }, {
      name: 'eventUrl',
      label: 'URL',
      type: 'url',
      placeholder: 'https://example.com',
      value: calendarEvent.eventUrl,
      required: false,
    }, {
      name: 'location',
      label: 'Location',
      type: 'text',
      placeholder: 'Birmingham, UK',
      value: calendarEvent.location,
      required: false,
    }, {
      name: 'transparency',
      label: 'Transparency',
      type: 'select',
      value: calendarEvent.transparency,
      options: (['opaque', 'transparent'] as CalendarEvent['transparency'][]).map((
        transparency,
      ) => ({
        label: capitalizeWord(transparency),
        value: transparency,
      })),
      required: true,
    });
  } else if (updateType === 'raw') {
    fields.push({
      name: 'ics',
      label: 'Raw ICS',
      type: 'textarea',
      placeholder: 'Raw ICS...',
      value: calendarEvent.data,
      description:
        'This is the raw ICS for this event. Use this to manually update the event _if_ you know what you are doing.',
      rows: '10',
    });
  }

  return fields;
}

export default function ViewCalendarEvent(
  { initialCalendarEvent, calendars, formData: formDataObject, error, notice }: ViewCalendarEventProps,
) {
  const isDeleting = useSignal<boolean>(false);
  const calendarEvent = useSignal<CalendarEvent>(initialCalendarEvent);

  const formData = convertObjectToFormData(formDataObject);

  async function onClickDeleteEvent() {
    const message = calendarEvent.peek().isRecurring
      ? 'Are you sure you want to delete _all_ instances of this recurring event?'
      : 'Are you sure you want to delete this event?';
    if (confirm(message)) {
      if (isDeleting.value) {
        return;
      }

      isDeleting.value = true;

      try {
        const requestBody: DeleteRequestBody = {
          calendarIds: calendars.map((calendar) => calendar.uid!),
          calendarView: 'day',
          calendarStartDate: new Date().toISOString().substring(0, 10),
          calendarEventId: calendarEvent.value.uid!,
          calendarId: calendarEvent.value.calendarId,
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
              src='/public/images/delete.svg'
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
          <div
            dangerouslySetInnerHTML={{
              __html: formFields(calendarEvent.peek(), calendars, 'ui').map((field) =>
                generateFieldHtml(field, formData)
              ).join(''),
            }}
          />

          <section class='flex justify-end items-center mt-8 mb-4'>
            {calendarEvent.peek().isRecurring
              ? (
                <p class='text-sm text-slate-400 mr-4'>
                  Note that you'll update all instances of this recurring event.
                </p>
              )
              : null}
            <button class='button' type='submit'>Update event</button>
          </section>
        </form>

        <hr class='my-8 border-slate-700' />

        <details class='mb-12 group'>
          <summary class='text-slate-100 flex items-center font-bold cursor-pointer text-center justify-center mx-auto hover:text-sky-400'>
            Edit Raw ICS{' '}
            <span class='ml-2 text-slate-400 group-open:rotate-90 transition-transform duration-200'>
              <img src='/public/images/right.svg' alt='Expand' width={16} height={16} class='white' />
            </span>
          </summary>

          <form method='POST' class='mb-12'>
            <div
              dangerouslySetInnerHTML={{
                __html: formFields(calendarEvent.peek(), calendars, 'raw').map((field) =>
                  generateFieldHtml(field, formData)
                ).join(''),
              }}
            />

            <section class='flex justify-end mt-8 mb-4'>
              <button class='button' type='submit'>Update ICS</button>
            </section>
          </form>
        </details>

        <span
          class={`flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`}
        >
          {isDeleting.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />Deleting...
              </>
            )
            : null}
          {!isDeleting.value ? <>&nbsp;</> : null}
        </span>
      </section>
    </>
  );
}
