import { Handler } from 'fresh/server.ts';
import { parse } from 'xml/mod.ts';

import { Contact, FreshContextState } from '/lib/types.ts';
import { buildRFC822Date, convertObjectToDavXml, DAV_RESPONSE_HEADER, escapeHtml, escapeXml } from '/lib/utils/misc.ts';
import { formatContactToVCard, parseVCardFromTextContents } from '/lib/utils/contacts.ts';
import { createContact, deleteContact, getContact, updateContact } from '/lib/data/contacts.ts';
import { createSessionCookie } from '/lib/auth.ts';

interface Data {}

interface DavResponse {
  'd:href': string;
  'd:propstat': {
    'd:prop': {
      'd:resourcetype': {
        'd:collection'?: {};
        'card:addressbook'?: {};
      };
      'card:address-data'?: string;
      'd:getlastmodified'?: string;
      'd:getetag'?: string;
      'd:getcontenttype'?: string;
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

  if (
    request.method !== 'PROPFIND' && request.method !== 'REPORT' && request.method !== 'GET' &&
    request.method !== 'PUT' && request.method !== 'DELETE'
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  const { contactId } = context.params;

  let contact: Contact | null = null;

  try {
    contact = await getContact(contactId, context.state.user.id);
  } catch (error) {
    console.error(error);
  }

  if (!contact) {
    if (request.method === 'PUT') {
      const requestBody = await request.clone().text();

      const [partialContact] = parseVCardFromTextContents(requestBody);

      if (partialContact.first_name) {
        const newContact = await createContact(
          context.state.user.id,
          partialContact.first_name,
          partialContact.last_name || '',
        );

        // Use the sent id for the UID
        if (!partialContact.extra?.uid) {
          partialContact.extra = {
            ...(partialContact.extra || {}),
            uid: contactId,
          };
        }

        newContact.extra = partialContact.extra!;

        await updateContact(newContact);

        contact = await getContact(newContact.id, context.state.user.id);

        return new Response('Created', { status: 201, headers: { 'etag': `"${contact.revision}"` } });
      }
    }

    return new Response('Not found', { status: 404 });
  }

  if (request.method === 'DELETE') {
    const clientRevision = request.headers.get('if-match') || request.headers.get('etag');

    // Don't update outdated data
    if (clientRevision && clientRevision !== `"${contact.revision}"`) {
      return new Response(null, { status: 204, headers: { 'etag': `"${contact.revision}"` } });
    }

    await deleteContact(contactId, context.state.user.id);

    return new Response(null, { status: 202 });
  }

  if (request.method === 'PUT') {
    const clientRevision = request.headers.get('if-match') || request.headers.get('etag');

    // Don't update outdated data
    if (clientRevision && clientRevision !== `"${contact.revision}"`) {
      return new Response(null, { status: 204, headers: { 'etag': `"${contact.revision}"` } });
    }

    const requestBody = await request.clone().text();

    const [partialContact] = parseVCardFromTextContents(requestBody);

    contact = {
      ...contact,
      ...partialContact,
    };

    await updateContact(contact);

    contact = await getContact(contactId, context.state.user.id);

    return new Response(null, { status: 204, headers: { 'etag': `"${contact.revision}"` } });
  }

  if (request.method === 'GET') {
    // Set a UID if there isn't one
    if (!contact.extra.uid) {
      contact.extra.uid = crypto.randomUUID();
      await updateContact(contact);

      contact = await getContact(contactId, context.state.user.id);
    }

    const response = new Response(formatContactToVCard([contact]), {
      status: 200,
      headers: { 'etag': `"${contact.revision}"` },
    });

    if (context.state.session) {
      return response;
    }

    return createSessionCookie(request, context.state.user, response, true);
  }

  const requestBody = (await request.clone().text()).toLowerCase();

  let includeVCard = false;

  try {
    const parsedDocument = parse(requestBody);

    const multiGetRequest = (parsedDocument['r:addressbook-multiget'] || parsedDocument['r:addressbook-query'] ||
      parsedDocument['card:addressbook-multiget'] || parsedDocument['card:addressbook-query']) as
        | Record<string, any>
        | undefined;

    includeVCard = Boolean(multiGetRequest);
  } catch (error) {
    console.error(`Failed to parse XML`, error);
  }

  const parsedContact: DavResponse = {
    'd:href': `/dav/addressbooks/contacts/${contact.id}.vcf`,
    'd:propstat': {
      'd:prop': {
        'd:getlastmodified': buildRFC822Date(contact.updated_at.toISOString()),
        'd:getetag': escapeHtml(`"${contact.revision}"`),
        'd:getcontenttype': 'text/vcard; charset=utf-8',
        'd:resourcetype': {},
      },
      'd:status': 'HTTP/1.1 200 OK',
    },
  };

  if (includeVCard) {
    parsedContact['d:propstat']['d:prop']['card:address-data'] = escapeXml(formatContactToVCard([contact]));
  }

  const responseBody: ResponseBody = {
    'd:multistatus': {
      'd:response': [parsedContact],
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
