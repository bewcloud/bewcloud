import { Handler } from 'fresh/server.ts';
import { parse } from 'xml/mod.ts';

import { FreshContextState } from '/lib/types.ts';
import { buildRFC822Date, convertObjectToDavXml, DAV_RESPONSE_HEADER, escapeHtml, escapeXml } from '/lib/utils/misc.ts';
import { formatContactToVCard } from '/lib/utils/contacts.ts';
import { getAllContacts } from '/lib/data/contacts.ts';
import { createSessionCookie } from '/lib/auth.ts';

interface Data {}

interface DavResponse {
  'd:href': string;
  'd:propstat': {
    'd:prop': {
      'd:resourcetype'?: {
        'd:collection'?: {};
        'card:addressbook'?: {};
      };
      'd:displayname'?: string | {};
      'card:address-data'?: string;
      'd:getlastmodified'?: string | {};
      'd:getetag'?: string | {};
      'd:getcontenttype'?: string | {};
      'd:getcontentlength'?: number | {};
      'd:creationdate'?: string | {};
      'card:addressbook-description'?: string | {};
      'cs:getctag'?: {};
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

  if (request.method === 'GET') {
    return new Response('This is the WebDAV interface. It can only be accessed by WebDAV clients.');
  }

  if (request.method !== 'PROPFIND' && request.method !== 'REPORT') {
    return new Response('Bad Request', { status: 400 });
  }

  const contacts = await getAllContacts(context.state.user.id);

  const requestBody = (await request.clone().text()).toLowerCase();

  let includeVCard = false;
  let includeCollection = true;
  const includePrivileges = requestBody.includes('current-user-privilege-set');

  const filterContactIds = new Set<string>();

  try {
    const parsedDocument = parse(requestBody);

    const multiGetRequest = (parsedDocument['addressbook-multiget'] || parsedDocument['r:addressbook-multiget'] ||
      parsedDocument['f:addressbook-multiget'] || parsedDocument['d:addressbook-multiget'] ||
      parsedDocument['r:addressbook-query'] ||
      parsedDocument['card:addressbook-multiget'] || parsedDocument['card:addressbook-query']) as
        | Record<string, any>
        | undefined;

    includeVCard = Boolean(multiGetRequest);

    const requestedHrefs: string[] = (multiGetRequest && (multiGetRequest['href'] || multiGetRequest['d:href'])) || [];

    includeCollection = requestedHrefs.length === 0;

    for (const requestedHref of requestedHrefs) {
      const userVCard = requestedHref.split('/').slice(-1).join('');
      const [userId] = userVCard.split('.vcf');

      if (userId) {
        filterContactIds.add(userId);
      }
    }
  } catch (error) {
    console.error(`Failed to parse XML`, error);
  }

  const filteredContacts = filterContactIds.size > 0
    ? contacts.filter((contact) => filterContactIds.has(contact.id))
    : contacts;

  const parsedContacts = filteredContacts.map((contact) => {
    const parsedContact: DavResponse = {
      'd:href': `/dav/addressbooks/contacts/${contact.id}.vcf`,
      'd:propstat': [{
        'd:prop': {
          'd:getlastmodified': buildRFC822Date(contact.updated_at.toISOString()),
          'd:getetag': escapeHtml(`"${contact.revision}"`),
          'd:getcontenttype': 'text/vcard; charset=utf-8',
          'd:resourcetype': {},
        },
        'd:status': 'HTTP/1.1 200 OK',
      }, {
        'd:prop': {
          'd:displayname': {},
          'd:getcontentlength': {},
          'd:creationdate': {},
          'card:addressbook-description': {},
          'cs:getctag': {},
        },
        'd:status': 'HTTP/1.1 404 Not Found',
      }],
    };

    if (includeVCard) {
      parsedContact['d:propstat'][0]['d:prop']['card:address-data'] = escapeXml(formatContactToVCard([contact]));
    }

    if (includePrivileges) {
      parsedContact['d:propstat'][0]['d:prop']['d:current-user-privilege-set'] = {
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

    return parsedContact;
  });

  const responseBody: ResponseBody = {
    'd:multistatus': {
      'd:response': [
        ...parsedContacts,
      ],
    },
    'd:multistatus_attributes': {
      'xmlns:d': 'DAV:',
      'xmlns:s': 'http://sabredav.org/ns',
      'xmlns:card': 'urn:ietf:params:xml:ns:carddav',
      'xmlns:oc': 'http://owncloud.org/ns',
      'xmlns:nc': 'http://nextcloud.org/ns',
      'xmlns:cs': 'http://calendarserver.org/ns/',
    },
  };

  if (includeCollection) {
    const collectionResponse: DavResponse = {
      'd:href': '/dav/addressbooks/contacts/',
      'd:propstat': [{
        'd:prop': {
          'd:resourcetype': {
            'd:collection': {},
            'card:addressbook': {},
          },
          'd:displayname': 'Contacts',
          'd:getetag': escapeHtml(`"${context.state.user.extra.contacts_revision || 'new'}"`),
        },
        'd:status': 'HTTP/1.1 200 OK',
      }, {
        'd:prop': {
          'd:getlastmodified': {},
          'd:getcontenttype': {},
          'd:getcontentlength': {},
          'd:creationdate': {},
          'card:addressbook-description': {},
          'cs:getctag': {},
        },
        'd:status': 'HTTP/1.1 404 Not Found',
      }],
    };

    if (includePrivileges) {
      collectionResponse['d:propstat'][0]['d:prop']['d:current-user-privilege-set'] = {
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
    responseBody['d:multistatus']['d:response'].unshift(collectionResponse);
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
