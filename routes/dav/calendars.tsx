import { Handler } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { convertObjectToDavXml, DAV_RESPONSE_HEADER, escapeHtml } from '/lib/utils/misc.ts';
import { getColorAsHex } from '/lib/utils/calendar.ts';
import { createSessionCookie } from '/lib/auth.ts';
import { getCalendars } from '/lib/data/calendar.ts';

interface Data {}

interface DavResponse {
  'd:href': string;
  'd:propstat': {
    'd:prop': {
      'd:resourcetype'?: {
        'd:collection': {};
        'cal:calendar'?: {};
      };
      'd:displayname'?: string | {};
      'd:getetag'?: string | {};
      'cs:getctag'?: string | {};
      'd:current-user-principal'?: {
        'd:href': string;
      };
      'd:principal-URL'?: {};
      'd:current-user-privilege-set'?: {
        'd:privilege': {
          'd:write-properties'?: {};
          'd:write'?: {};
          'd:write-content'?: {};
          'd:unlock'?: {};
          'd:bind'?: {};
          'd:unbind'?: {};
          'd:write-acl'?: {};
          'd:read'?: {};
          'd:read-acl'?: {};
          'd:read-current-user-privilege-set'?: {};
        }[];
      };
      'ic:calendar-color'?: string;
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
    'xmlns:ic': string;
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

  if (request.method === 'GET') {
    return new Response('This is the WebDAV interface. It can only be accessed by WebDAV clients.');
  }

  if (request.method !== 'PROPFIND' && request.method !== 'REPORT') {
    return new Response('Bad Request', { status: 400 });
  }

  const responseBody: ResponseBody = {
    'd:multistatus': {
      'd:response': [
        {
          'd:href': '/dav/calendars/',
          'd:propstat': [{
            'd:prop': {
              'd:resourcetype': {
                'd:collection': {},
              },
              'd:current-user-principal': {
                'd:href': '/dav/principals/',
              },
            },
            'd:status': 'HTTP/1.1 200 OK',
          }, {
            'd:prop': { 'd:principal-URL': {}, 'd:displayname': {}, 'cs:getctag': {} },
            'd:status': 'HTTP/1.1 404 Not Found',
          }],
        },
      ],
    },
    'd:multistatus_attributes': {
      'xmlns:d': 'DAV:',
      'xmlns:s': 'http://sabredav.org/ns',
      'xmlns:cal': 'urn:ietf:params:xml:ns:caldav',
      'xmlns:oc': 'http://owncloud.org/ns',
      'xmlns:nc': 'http://nextcloud.org/ns',
      'xmlns:cs': 'http://calendarserver.org/ns/',
      'xmlns:ic': 'http://apple.com/ns/ical/',
    },
  };

  const calendars = await getCalendars(context.state.user.id);

  const requestBody = (await request.clone().text()).toLowerCase();

  const includePrivileges = requestBody.includes('current-user-privilege-set');
  const includeColor = requestBody.includes('calendar-color');

  if (includePrivileges) {
    responseBody['d:multistatus']['d:response'][0]['d:propstat'][0]['d:prop']['d:current-user-privilege-set'] = {
      'd:privilege': [
        { 'd:write-properties': {} },
        { 'd:write': {} },
        { 'd:write-content': {} },
        { 'd:unlock': {} },
        { 'd:bind': {} },
        { 'd:unbind': {} },
        { 'd:write-acl': {} },
        { 'd:read': {} },
        { 'd:read-acl': {} },
        { 'd:read-current-user-privilege-set': {} },
      ],
    };
  }

  for (const calendar of calendars) {
    const parsedCalendar: DavResponse = {
      'd:href': `/dav/calendars/${calendar.id}`,
      'd:propstat': [{
        'd:prop': {
          'd:resourcetype': {
            'd:collection': {},
            'cal:calendar': {},
          },
          'd:displayname': calendar.name,
          'd:getetag': escapeHtml(`"${calendar.revision}"`),
          'cs:getctag': calendar.revision,
          'd:current-user-principal': {
            'd:href': '/dav/principals/',
          },
        },
        'd:status': 'HTTP/1.1 200 OK',
      }, {
        'd:prop': { 'd:principal-URL': {} },
        'd:status': 'HTTP/1.1 404 Not Found',
      }],
    };

    if (includePrivileges) {
      parsedCalendar['d:propstat'][0]['d:prop']['d:current-user-privilege-set'] = {
        'd:privilege': [
          { 'd:write-properties': {} },
          { 'd:write': {} },
          { 'd:write-content': {} },
          { 'd:unlock': {} },
          { 'd:bind': {} },
          { 'd:unbind': {} },
          { 'd:write-acl': {} },
          { 'd:read': {} },
          { 'd:read-acl': {} },
          { 'd:read-current-user-privilege-set': {} },
        ],
      };
    }

    if (includeColor) {
      parsedCalendar['d:propstat'][0]['d:prop']['ic:calendar-color'] = getColorAsHex(calendar.color);
    }

    responseBody['d:multistatus']['d:response'].push(parsedCalendar);
  }

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
