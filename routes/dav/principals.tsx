import { Handler } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { convertObjectToDavXml, DAV_RESPONSE_HEADER } from '/lib/utils.ts';
import { createSessionCookie } from '/lib/auth.ts';

interface Data {}

interface DavResponse {
  'd:href': string;
  'd:propstat': {
    'd:prop': {
      'd:resourcetype': {
        'd:collection'?: {};
        'd:principal': {};
      };
      'd:displayname'?: string;
      'card:addressbook-home-set'?: {
        'd:href': string;
      };
      'd:current-user-principal'?: {
        'd:href': string;
      };
      'd:principal-URL'?: {
        'd:href': string;
      };
    };
    'd:status': string;
  };
}

interface DavMultiStatusResponse {
  'd:multistatus': {
    'd:response': DavResponse[];
  };
  'd:multistatus_attributes': {
    'xmlns:d': string;
    'xmlns:s': string;
    'xmlns:cal': string;
    'xmlns:cs': string;
    'xmlns:card': string;
    'xmlns:oc': string;
    'xmlns:nc': string;
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
      'd:response': [],
    },
    'd:multistatus_attributes': {
      'xmlns:d': 'DAV:',
      'xmlns:s': 'http://sabredav.org/ns',
      'xmlns:cal': 'urn:ietf:params:xml:ns:caldav',
      'xmlns:cs': 'http://calendarserver.org/ns/',
      'xmlns:card': 'urn:ietf:params:xml:ns:carddav',
      'xmlns:oc': 'http://owncloud.org/ns',
      'xmlns:nc': 'http://nextcloud.org/ns',
    },
  };

  if (request.method === 'PROPFIND') {
    const propResponse: DavResponse = {
      'd:href': '/dav/principals/',
      'd:propstat': {
        'd:prop': {
          'd:resourcetype': {
            'd:collection': {},
            'd:principal': {},
          },
          'd:current-user-principal': {
            'd:href': '/dav/principals/',
          },
          'd:principal-URL': {
            'd:href': '/dav/principals/',
          },
        },
        'd:status': 'HTTP/1.1 200 OK',
      },
    };

    const requestBody = (await request.clone().text()).toLowerCase();

    if (requestBody.includes('displayname')) {
      propResponse['d:propstat']['d:prop']['d:displayname'] = `${context.state.user.email}`;
    }

    if (requestBody.includes('addressbook-home-set')) {
      propResponse['d:propstat']['d:prop']['card:addressbook-home-set'] = {
        'd:href': `/dav/addressbooks/`,
      };
    }

    responseBody['d:multistatus']['d:response'].push(propResponse);
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
