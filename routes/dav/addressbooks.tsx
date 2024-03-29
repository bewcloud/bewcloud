import { Handler } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { convertObjectToDavXml, DAV_RESPONSE_HEADER, escapeHtml } from '/lib/utils/misc.ts';
import { createSessionCookie } from '/lib/auth.ts';

interface Data {}

interface DavResponse {
  'd:href': string;
  'd:propstat': {
    'd:prop': {
      'd:resourcetype'?: {
        'd:collection': {};
        'card:addressbook'?: {};
      };
      'd:displayname'?: string;
      'd:getetag'?: string;
      'd:current-user-principal'?: {
        'd:href': string;
      };
      'd:principal-URL'?: {};
      'card:addressbook-home-set'?: {};
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
    'xmlns:card': string;
    'xmlns:oc': string;
    'xmlns:nc': string;
  };
}

interface ResponseBody extends DavMultiStatusResponse {}

export const handler: Handler<Data, FreshContextState> = (request, context) => {
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
          'd:href': '/dav/addressbooks/',
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
            'd:prop': { 'd:principal-URL': {}, 'card:addressbook-home-set': {} },
            'd:status': 'HTTP/1.1 404 Not Found',
          }],
        },
        {
          'd:href': '/dav/addressbooks/contacts/',
          'd:propstat': [{
            'd:prop': {
              'd:resourcetype': {
                'd:collection': {},
                'card:addressbook': {},
              },
              'd:displayname': 'Contacts',
              'd:getetag': escapeHtml(`"${context.state.user.extra.contacts_revision || 'new'}"`),
              'd:current-user-principal': {
                'd:href': '/dav/principals/',
              },
            },
            'd:status': 'HTTP/1.1 200 OK',
          }, {
            'd:prop': { 'd:principal-URL': {}, 'card:addressbook-home-set': {} },
            'd:status': 'HTTP/1.1 404 Not Found',
          }],
        },
      ],
    },
    'd:multistatus_attributes': {
      'xmlns:d': 'DAV:',
      'xmlns:s': 'http://sabredav.org/ns',
      'xmlns:card': 'urn:ietf:params:xml:ns:carddav',
      'xmlns:oc': 'http://owncloud.org/ns',
      'xmlns:nc': 'http://nextcloud.org/ns',
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
