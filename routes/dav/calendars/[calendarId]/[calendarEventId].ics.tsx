import { Handler } from 'fresh/server.ts';

import { Calendar, CalendarEvent, FreshContextState } from '/lib/types.ts';
import {
  buildRFC822Date,
  convertObjectToDavXml,
  DAV_RESPONSE_HEADER,
  escapeHtml,
  escapeXml,
  formatCalendarEventsToVCalendar,
  parseVCalendarFromTextContents,
} from '/lib/utils.ts';
import { getCalendar, getCalendarEvent, getCalendarEvents, updateCalendarEvent } from '/lib/data/calendar.ts';
import { createSessionCookie } from '/lib/auth.ts';

interface Data {}

interface DavResponse {
  'd:href': string;
  'd:propstat': {
    'd:prop': {
      'd:resourcetype'?: {
        'd:collection'?: {};
        'cal:calendar'?: {};
      };
      'd:displayname'?: string | {};
      'cal:calendar-data'?: string;
      'd:getlastmodified'?: string;
      'd:getetag'?: string;
      'cs:getctag'?: string;
      'd:getcontenttype'?: string;
      'd:getcontentlength'?: {};
      'd:creationdate'?: string;
    };
    'd:status': string;
  }[];
}

interface DavMultiStatusResponse {
  'd:multistatus': {
    'd:response': DavResponse[];
  };
  'd:multistatus_attributes': {
    'xmlns:d': string;
    'xmlns:s': string;
    'xmlns:cal': string;
    'xmlns:oc': string;
    'xmlns:nc': string;
    'xmlns:cs': string;
  };
}

interface ResponseBody extends DavMultiStatusResponse {}

export const handler: Handler<Data, FreshContextState> = async (request, context) => {
  if (!context.state.user) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'www-authenticate': 'Basic realm="bewCloud", charset="UTF-8"' },
    });
  }

  if (
    request.method !== 'PROPFIND' && request.method !== 'REPORT' && request.method !== 'GET' &&
    request.method !== 'PUT' && request.method !== 'DELETE'
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  const { calendarId, calendarEventId } = context.params;

  let calendar: Calendar | null = null;
  let calendarEvent: CalendarEvent | null = null;

  try {
    calendar = await getCalendar(calendarId, context.state.user.id);
  } catch (error) {
    console.error(error);
  }

  if (!calendar) {
    return new Response('Not found', { status: 404 });
  }

  try {
    calendarEvent = await getCalendarEvent(calendarEventId, context.state.user.id);
  } catch (error) {
    console.error(error);
  }

  if (!calendarEvent) {
    if (request.method === 'PUT') {
      // TODO: Build this
      // const newCalendarEvent = await createCalendarEvent(
      //   context.state.user.id,
      //   partialCalendarEvent.title,
      //   partialCalendarEvent.start_date,
      //   partialCalendarEvent.end_date,
      // );

      // // Use the sent id for the UID
      // if (!partialCalendarEvent.extra?.uid) {
      //   partialCalendarEvent.extra = {
      //     ...(partialCalendarEvent.extra! || {}),
      //     uid: calendarId,
      //   };
      // }

      // newCalendarEvent.extra = partialCalendarEvent.extra!;

      // await updateCalendarEvent(newCalendarEvent);

      // const calendarEvent = await getCalendarEvent(newCalendarEvent.id, context.state.user.id);

      // return new Response('Created', { status: 201, headers: { 'etag': `"${calendarEvent.revision}"` } });
    }

    return new Response('Not found', { status: 404 });
  }

  // TODO: Build this
  // if (request.method === 'DELETE') {
  //   const clientRevision = request.headers.get('if-match') || request.headers.get('etag');

  //   // Don't update outdated data
  //   if (clientRevision && clientRevision !== `"${calendarEvent.revision}"`) {
  //     return new Response(null, { status: 204, headers: { 'etag': `"${calendarEvent.revision}"` } });
  //   }

  //   await deleteContact(contactId, context.state.user.id);

  //   return new Response(null, { status: 202 });
  // }

  // if (request.method === 'PUT') {
  //   const clientRevision = request.headers.get('if-match') || request.headers.get('etag');

  //   // Don't update outdated data
  //   if (clientRevision && clientRevision !== `"${contact.revision}"`) {
  //     return new Response(null, { status: 204, headers: { 'etag': `"${contact.revision}"` } });
  //   }

  //   const requestBody = await request.clone().text();

  //   const [partialContact] = parseVCardFromTextContents(requestBody);

  //   contact = {
  //     ...contact,
  //     ...partialContact,
  //   };

  //   await updateContact(contact);

  //   contact = await getContact(contactId, context.state.user.id);

  //   return new Response(null, { status: 204, headers: { 'etag': `"${contact.revision}"` } });
  // }

  if (request.method === 'GET') {
    // Set a UID if there isn't one
    if (!calendarEvent.extra.uid) {
      calendarEvent.extra.uid = crypto.randomUUID();
      await updateCalendarEvent(calendarEvent);

      calendarEvent = await getCalendarEvent(calendarEventId, context.state.user.id);
    }

    const response = new Response(formatCalendarEventsToVCalendar([calendarEvent], [calendar]), {
      status: 200,
    });

    if (context.state.session) {
      return response;
    }

    return createSessionCookie(request, context.state.user, response, true);
  }

  const requestBody = (await request.clone().text()).toLowerCase();

  const includeVCalendar = requestBody.includes('calendar-data');

  const parsedCalendarEvent: DavResponse = {
    'd:href': `/dav/calendars/${calendar!.id}/${calendarEvent.id}.ics`,
    'd:propstat': [{
      'd:prop': {
        'd:getlastmodified': buildRFC822Date(calendarEvent.updated_at.toISOString()),
        'd:getetag': escapeHtml(`"${calendarEvent.revision}"`),
        'cs:getctag': calendarEvent.revision,
        'd:getcontenttype': 'text/calendar; charset=utf-8',
        'd:resourcetype': {},
        'd:creationdate': buildRFC822Date(calendarEvent.created_at.toISOString()),
      },
      'd:status': 'HTTP/1.1 200 OK',
    }, {
      'd:prop': {
        'd:displayname': {},
        'd:getcontentlength': {},
      },
      'd:status': 'HTTP/1.1 404 Not Found',
    }],
  };

  if (includeVCalendar) {
    parsedCalendarEvent['d:propstat'][0]['d:prop']['cal:calendar-data'] = escapeXml(
      formatCalendarEventsToVCalendar([calendarEvent], [calendar!]),
    );
  }

  const responseBody: ResponseBody = {
    'd:multistatus': {
      'd:response': [parsedCalendarEvent],
    },
    'd:multistatus_attributes': {
      'xmlns:d': 'DAV:',
      'xmlns:s': 'http://sabredav.org/ns',
      'xmlns:cal': 'urn:ietf:params:xml:ns:caldav',
      'xmlns:oc': 'http://owncloud.org/ns',
      'xmlns:nc': 'http://nextcloud.org/ns',
      'xmlns:cs': 'http://calendarserver.org/ns/',
    },
  };

  const response = new Response(convertObjectToDavXml(responseBody, true), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'dav': DAV_RESPONSE_HEADER,
    },
    status: 207,
  });

  if (context.state.session) {
    return response;
  }

  return createSessionCookie(request, context.state.user, response, true);
};
