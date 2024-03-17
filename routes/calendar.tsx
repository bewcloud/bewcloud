import { Handlers, PageProps } from 'fresh/server.ts';

import { Calendar, CalendarEvent, FreshContextState } from '/lib/types.ts';
// import { getCalendars, getCalendarEvents } from '/lib/data/calendar.ts';
import MainCalendar from '/islands/calendar/MainCalendar.tsx';

async function getCalendars(userId: string): Promise<Pick<Calendar, 'id' | 'name' | 'color' | 'is_visible'>[]> {
  // TODO: Remove this
  await new Promise((resolve) => setTimeout(() => resolve(true), 1));

  return [
    {
      id: 'family-1',
      name: 'Family',
      color: 'bg-purple-500',
      is_visible: true,
    },
    {
      id: 'personal-1',
      name: 'Personal',
      color: 'bg-sky-600',
      is_visible: true,
    },
    {
      id: 'house-chores-1',
      name: 'House Chores',
      color: 'bg-red-700',
      is_visible: true,
    },
  ];
}

async function getCalendarEvents(userId: string, calendarIds: string[]): Promise<CalendarEvent[]> {
  // TODO: Remove this
  await new Promise((resolve) => setTimeout(() => resolve(true), 1));

  return [
    {
      id: 'event-1',
      user_id: userId,
      calendar_id: 'family-1',
      revision: 'fake-rev',
      title: 'Dentist',
      start_date: new Date('2024-03-17T14:00:00.000Z'),
      end_date: new Date('2024-03-17T15:00:00.000Z'),
      is_all_day: false,
      status: 'scheduled',
      extra: {
        visibility: 'default',
      },
      updated_at: new Date(),
      created_at: new Date(),
    },
    {
      id: 'event-2',
      user_id: userId,
      calendar_id: 'personal-1',
      revision: 'fake-rev',
      title: 'Dermatologist',
      start_date: new Date('2024-03-17T16:30:00.000Z'),
      end_date: new Date('2024-03-17T17:30:00.000Z'),
      is_all_day: false,
      status: 'scheduled',
      extra: {
        visibility: 'default',
      },
      updated_at: new Date(),
      created_at: new Date(),
    },
    {
      id: 'event-3',
      user_id: userId,
      calendar_id: 'house-chores-1',
      revision: 'fake-rev',
      title: 'Vacuum',
      start_date: new Date('2024-03-16T15:00:00.000Z'),
      end_date: new Date('2024-03-16T16:00:00.000Z'),
      is_all_day: false,
      status: 'scheduled',
      extra: {
        visibility: 'default',
      },
      updated_at: new Date(),
      created_at: new Date(),
    },
  ];
}

interface Data {
  userCalendars: Pick<Calendar, 'id' | 'name' | 'color' | 'is_visible'>[];
  userCalendarEvents: CalendarEvent[];
  view: 'day' | 'week' | 'month';
  startDate: string;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const searchParams = new URL(request.url).searchParams;

    const view = (searchParams.get('view') as Data['view']) || 'week';
    const startDate = searchParams.get('startDate') || new Date().toISOString().substring(0, 10);

    const userCalendars = await getCalendars(context.state.user.id);
    const visibleCalendarIds = userCalendars.filter((calendar) => calendar.is_visible).map((calendar) => calendar.id);
    const userCalendarEvents = await getCalendarEvents(context.state.user.id, visibleCalendarIds);

    return await context.render({ userCalendars, userCalendarEvents, view, startDate });
  },
};

export default function CalendarPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <MainCalendar
        initialCalendars={data.userCalendars}
        initialCalendarEvents={data.userCalendarEvents}
        view={data.view}
        startDate={data.startDate}
      />
    </main>
  );
}
