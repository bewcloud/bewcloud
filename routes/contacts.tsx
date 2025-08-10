import { Handlers, PageProps } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { AddressBook, Contact, ContactModel } from '/lib/models/contacts.ts';
import Contacts from '/islands/contacts/Contacts.tsx';
import { AppConfig } from '/lib/config.ts';

interface Data {
  addressBookId: string;
  userContacts: Contact[];
  userAddressBooks: AddressBook[];
  page: number;
  contactsCount: number;
  baseUrl: string;
  search?: string;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const baseUrl = (await AppConfig.getConfig()).auth.baseUrl;
    const contactsConfig = await AppConfig.getContactsConfig();

    if (!contactsConfig.enableCardDavServer) {
      throw new Error('CardDAV server is not enabled');
    }

    const userId = context.state.user.id;

    const searchParams = new URL(request.url).searchParams;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const search = searchParams.get('search') || undefined;
    let addressBookId = searchParams.get('addressBookId') || undefined;

    let userAddressBooks = await ContactModel.listAddressBooks(userId);

    // Create default address book if none exists
    if (userAddressBooks.length === 0) {
      await ContactModel.createAddressBook(userId, 'Contacts');

      userAddressBooks = await ContactModel.listAddressBooks(userId);
    }

    if (!addressBookId) {
      addressBookId = userAddressBooks[0].uid!;
    }

    if (!addressBookId) {
      throw new Error('Invalid address book ID');
    }

    const userContacts = await ContactModel.list(userId, addressBookId);

    const lowerCaseSearch = search?.toLowerCase();

    const filteredContacts = lowerCaseSearch
      ? userContacts.filter((contact) =>
        contact.firstName!.toLowerCase().includes(lowerCaseSearch) ||
        contact.lastName?.toLowerCase().includes(lowerCaseSearch)
      )
      : userContacts;

    const contactsCount = filteredContacts.length;

    return await context.render({
      addressBookId,
      userContacts: filteredContacts,
      userAddressBooks,
      page,
      contactsCount,
      baseUrl,
      search,
    });
  },
};

export default function ContactsPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <Contacts
        initialAddressBookId={data?.addressBookId || ''}
        initialContacts={data?.userContacts || []}
        initialAddressBooks={data?.userAddressBooks || []}
        baseUrl={data.baseUrl}
        page={data?.page || 1}
        contactsCount={data?.contactsCount || 0}
        search={data?.search || ''}
      />
    </main>
  );
}
