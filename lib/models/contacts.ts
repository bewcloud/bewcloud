import { createDAVClient } from 'tsdav';

import { AppConfig } from '/lib/config.ts';
import { parseVCard } from '/lib/utils/contacts.ts';

interface DAVObject extends Record<string, any> {
  data?: string;
  displayName?: string;
  ctag?: string;
  url: string;
  uid?: string;
}

export interface Contact extends DAVObject {
  firstName?: string;
  lastName?: string;
  middleNames?: string[];
  title?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface AddressBook extends DAVObject {}

const contactsConfig = await AppConfig.getContactsConfig();

async function getClient(userId: string) {
  const client = await createDAVClient({
    serverUrl: contactsConfig.cardDavUrl,
    credentials: {},
    authMethod: 'Custom',
    // deno-lint-ignore require-await
    authFunction: async () => {
      return {
        'X-Remote-User': userId,
      };
    },
    fetchOptions: {
      timeout: 15_000,
    },
    defaultAccountType: 'carddav',
    rootUrl: `${contactsConfig.cardDavUrl}/`,
    principalUrl: `${contactsConfig.cardDavUrl}/${userId}/`,
    homeUrl: `${contactsConfig.cardDavUrl}/${userId}/`,
  });

  return client;
}

export class ContactModel {
  static async list(
    userId: string,
    addressBookId: string,
  ): Promise<Contact[]> {
    const client = await getClient(userId);

    const addressBookUrl = `${contactsConfig.cardDavUrl}/${userId}/${addressBookId}/`;

    const davContacts: DAVObject[] = await client.fetchVCards({
      addressBook: {
        url: addressBookUrl,
      },
    });

    const contacts: Contact[] = davContacts.map((davContact) => {
      return {
        ...davContact,
        ...parseVCard(davContact.data || '')[0],
      };
    });

    return contacts;
  }

  static async get(
    userId: string,
    addressBookId: string,
    contactId: string,
  ): Promise<Contact | undefined> {
    const contacts = await this.list(userId, addressBookId);

    return contacts.find((contact) => contact.uid === contactId);
  }

  static async create(
    userId: string,
    addressBookId: string,
    contactId: string,
    vCard: string,
  ): Promise<void> {
    const client = await getClient(userId);

    const addressBookUrl = `${contactsConfig.cardDavUrl}/${userId}/${addressBookId}/`;

    await client.createVCard({
      addressBook: {
        url: addressBookUrl,
      },
      vCardString: vCard,
      filename: `${contactId}.vcf`,
    });
  }

  static async update(
    userId: string,
    contactUrl: string,
    vCard: string,
  ): Promise<void> {
    const client = await getClient(userId);

    await client.updateVCard({
      vCard: {
        url: contactUrl,
        data: vCard,
      },
    });
  }

  static async delete(
    userId: string,
    contactUrl: string,
  ): Promise<void> {
    const client = await getClient(userId);

    await client.deleteVCard({
      vCard: {
        url: contactUrl,
      },
    });
  }

  static async listAddressBooks(
    userId: string,
  ): Promise<AddressBook[]> {
    const client = await getClient(userId);

    let davAddressBooks: DAVObject[] = [];

    try {
      davAddressBooks = await client.fetchAddressBooks();
    } catch (_error) {
      // It's possible the user doesn't exist in Radicale yet, so try creating it by doing a simple PROPFIND request for the main addressbook's address (Radicale will automatically create the user)
      const userUrl = `${contactsConfig.cardDavUrl}/${userId}/`;

      const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <prop>
    <card:addressbook-home-set/>
  </prop>
</propfind>`;

      await fetch(userUrl, {
        method: 'PROPFIND',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'X-Remote-User': userId,
        },
        body: xmlBody,
      });

      davAddressBooks = await client.fetchAddressBooks();
    }

    const addressBooks: AddressBook[] = davAddressBooks.map((davAddressBook) => {
      const uid = davAddressBook.url.split('/').filter(Boolean).pop()!;

      return {
        ...davAddressBook,
        uid,
      };
    });

    return addressBooks;
  }

  static async createAddressBook(
    userId: string,
    name: string,
  ): Promise<void> {
    const addressBookId = crypto.randomUUID();
    const addressBookUrl = `${contactsConfig.cardDavUrl}/${userId}/${addressBookId}/`;

    // For some reason this sends invalid XML
    // await client.makeCollection({
    //   url: addressBookUrl,
    //   props: {
    //     displayName: name,
    //   },
    // });

    // Make "manual" request (https://www.rfc-editor.org/rfc/rfc6352.html#page-14)
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<d:mkcol xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:set>
    <d:prop>
      <d:displayname>${encodeURIComponent(name)}</d:displayname>
      <d:resourcetype>
        <d:collection/>
        <card:addressbook/>
      </d:resourcetype>
    </d:prop>
  </d:set>
</d:mkcol>`;

    await fetch(addressBookUrl, {
      method: 'MKCOL',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Remote-User': userId,
      },
      body: xmlBody,
    });
  }

  static async deleteAddressBook(
    userId: string,
    addressBookId: string,
  ): Promise<void> {
    const client = await getClient(userId);

    const addressBookUrl = `${contactsConfig.cardDavUrl}/${userId}/${addressBookId}/`;

    await client.deleteObject({
      url: addressBookUrl,
    });
  }
}
