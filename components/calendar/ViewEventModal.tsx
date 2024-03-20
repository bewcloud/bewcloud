import { Calendar, CalendarEvent } from '/lib/types.ts';

interface ViewEventModalProps {
  isOpen: boolean;
  calendarEvent: CalendarEvent;
  calendar: Pick<Calendar, 'id' | 'name' | 'color'>;
  onClickDelete: (eventId: string) => void;
  onClose: () => void;
}

export default function ViewEventModal(
  { isOpen, calendarEvent, calendar, onClickDelete, onClose }: ViewEventModalProps,
) {
  if (!calendarEvent || !calendar) {
    return null;
  }

  const allDayEventDateFormat = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const hourFormat = new Intl.DateTimeFormat('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <section
        class={`fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900 bg-opacity-60`}
      >
      </section>

      <section
        class={`fixed ${
          isOpen ? 'block' : 'hidden'
        } z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg`}
      >
        <h1 class='text-2xl font-semibold my-5'>{calendarEvent.title}</h1>
        <header class='py-5 border-t border-b border-slate-500 font-semibold flex justify-between items-center'>
          <span>
            {calendarEvent.start_date ? allDayEventDateFormat.format(new Date(calendarEvent.start_date)) : ''}
          </span>
          {calendarEvent.is_all_day ? <span>All-day</span> : (
            <span>
              {calendarEvent.start_date ? hourFormat.format(new Date(calendarEvent.start_date)) : ''} -{' '}
              {calendarEvent.end_date ? hourFormat.format(new Date(calendarEvent.end_date)) : ''}
            </span>
          )}
        </header>
        <section class='py-5 my-0 border-b border-slate-500 flex justify-between items-center'>
          <span>
            {calendar.name}
          </span>
          <span
            class={`w-5 h-5 ml-2 block ${calendar.color} rounded-full`}
            title={calendar.color}
          />
        </section>
        <section class='py-5 my-0 border-b border-slate-500'>
          <p>TODO: recurrence</p>
        </section>
        {calendarEvent.extra.description
          ? (
            <section class='py-5 my-0 border-b border-slate-500'>
              <p>{calendarEvent.extra.description}</p>
            </section>
          )
          : null}
        {calendarEvent.extra.url
          ? (
            <section class='py-5 my-0 border-b border-slate-500'>
              <a href={calendarEvent.extra.url} target='_blank' rel='noopener noreferrer'>
                {calendarEvent.extra.url}
              </a>
            </section>
          )
          : null}
        {calendarEvent.extra.location
          ? (
            <section class='py-5 my-0 border-b border-slate-500'>
              <a
                href={`https://maps.google.com/maps?q=${encodeURIComponent(calendarEvent.extra.location)}`}
                target='_blank'
                rel='noopener noreferrer'
              >
                {calendarEvent.extra.location}
              </a>
            </section>
          )
          : null}
        <section class='py-5 mb-2 border-b border-slate-500'>
          <p>TODO: reminders</p>
        </section>
        <footer class='flex justify-between'>
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-red-600 text-white cursor-pointer rounded-md'
            onClick={() => onClickDelete(calendarEvent.id)}
          >
            Delete
          </button>
          <a
            href={`/calendar/events/${calendarEvent.id}`}
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
          >
            Edit
          </a>
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
