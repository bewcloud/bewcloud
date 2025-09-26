import { Calendar, CalendarEvent } from '/lib/models/calendar.ts';
import { convertRRuleToWords } from '/lib/utils/calendar.ts';

interface ViewEventModalProps {
  isOpen: boolean;
  calendarEvent: CalendarEvent;
  calendar: Calendar;
  onClickDelete: (eventId: string) => void;
  onClose: () => void;
  timezoneId: string;
}

export default function ViewEventModal(
  { isOpen, calendarEvent, calendar, onClickDelete, onClose, timezoneId }: ViewEventModalProps,
) {
  if (!calendarEvent || !calendar) {
    return null;
  }

  const allDayEventDateFormat = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezoneId, // Calendar dates are parsed without timezone info, so we need to force to a specific one so it's consistent across db, server, and client
  });
  const hourFormat = new Intl.DateTimeFormat('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezoneId, // Calendar dates are parsed without timezone info, so we need to force to a specific one so it's consistent across db, server, and client
  });

  return (
    <>
      <section
        class={`fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`}
      >
      </section>

      <section
        class={`fixed ${
          isOpen ? 'block' : 'hidden'
        } z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-96 max-w-lg bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`}
      >
        <h1 class='text-2xl font-semibold my-5'>{calendarEvent.title}</h1>
        <header class='py-5 border-t border-b border-slate-500 font-semibold flex justify-between items-center'>
          <span>
            {calendarEvent.startDate ? allDayEventDateFormat.format(new Date(calendarEvent.startDate)) : ''}
          </span>
          {calendarEvent.isAllDay ? <span>All-day</span> : (
            <span>
              {calendarEvent.startDate ? hourFormat.format(new Date(calendarEvent.startDate)) : ''} -{' '}
              {calendarEvent.endDate ? hourFormat.format(new Date(calendarEvent.endDate)) : ''}
            </span>
          )}
        </header>
        <section class='py-5 my-0 border-b border-slate-500 flex justify-between items-center'>
          <span>
            {calendar.displayName}
          </span>
          <span
            class={`w-5 h-5 ml-2 block rounded-full`}
            title={calendar.calendarColor}
            style={{ backgroundColor: calendar.calendarColor }}
          />
        </section>
        {calendarEvent.description
          ? (
            <section class='py-5 my-0 border-b border-slate-500'>
              <article class='overflow-auto max-w-full max-h-80 font-mono text-sm whitespace-pre-wrap'>
                {calendarEvent.description}
              </article>
            </section>
          )
          : null}
        {calendarEvent.eventUrl
          ? (
            <section class='py-5 my-0 border-b border-slate-500'>
              <a href={calendarEvent.eventUrl} target='_blank' rel='noopener noreferrer'>
                {calendarEvent.eventUrl}
              </a>
            </section>
          )
          : null}
        {calendarEvent.location
          ? (
            <section class='py-5 my-0 border-b border-slate-500'>
              <a
                href={`https://maps.google.com/maps?q=${encodeURIComponent(calendarEvent.location)}`}
                target='_blank'
                rel='noopener noreferrer'
              >
                {calendarEvent.location}
              </a>
            </section>
          )
          : null}
        {Array.isArray(calendarEvent.attendees) && calendarEvent.attendees.length > 0
          ? (
            <section class='py-5 my-0 border-b border-slate-500'>
              {calendarEvent.attendees.map((attendee) => (
                <p class='my-1'>
                  <a href={`mailto:${attendee.email}`} target='_blank' rel='noopener noreferrer'>
                    {attendee.name || attendee.email}
                  </a>{' '}
                  - {attendee.status}
                </p>
              ))}
            </section>
          )
          : null}
        {calendarEvent.isRecurring && calendarEvent.recurringRrule
          ? (
            <section class='py-5 my-0 border-b border-slate-500'>
              <p class='text-xs'>
                Repeats {convertRRuleToWords(calendarEvent.recurringRrule, { capitalizeSentence: false })}.
              </p>
            </section>
          )
          : null}
        {Array.isArray(calendarEvent.reminders) && calendarEvent.reminders.length > 0
          ? (
            <section class='py-5 my-0 border-b border-slate-500'>
              {calendarEvent.reminders.map((reminder) => (
                <p class='my-1 text-xs'>
                  {reminder.description || 'Reminder'} at {hourFormat.format(new Date(reminder.startDate))} via{' '}
                  {reminder.type}.
                </p>
              ))}
            </section>
          )
          : null}
        <footer class='flex justify-between mt-2'>
          <button
            type='button'
            class='px-5 py-2 bg-slate-600 hover:bg-red-600 text-white cursor-pointer rounded-md'
            onClick={() => onClickDelete(calendarEvent.uid!)}
          >
            Delete
          </button>
          <a
            href={`/calendar/${calendarEvent.uid}?calendarId=${calendar.uid}`}
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
            target='_blank'
          >
            Edit
          </a>
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
