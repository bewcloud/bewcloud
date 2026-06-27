import page, { RequestHandlerParams } from '/lib/page.ts';

import { AddressBook, Contact, ContactModel } from '/lib/models/contacts.ts';
import { AppConfig } from '/lib/config.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import { html } from '/public/ts/utils/misc.ts';
import Loading from '/components/Loading.ts';

const titlePrefix = 'Contacts';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  const baseUrl = (await AppConfig.getConfig()).auth.baseUrl;
  const contactsConfig = await AppConfig.getContactsConfig();

  if (!contactsConfig.enableCardDavServer) {
    throw new Error('CardDAV server is not enabled');
  }

  if (!(await AppConfig.isAppEnabled('contacts'))) {
    throw new Error('Contacts app is not enabled');
  }

  const userId = user!.id;

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

  const htmlContent = defaultHtmlContent({
    addressBookId,
    userContacts: filteredContacts,
    userAddressBooks,
    page,
    contactsCount,
    baseUrl,
    search,
  });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix,
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent({ addressBookId, userContacts, userAddressBooks, page, contactsCount, baseUrl, search }: {
  addressBookId: string;
  userContacts: Contact[];
  userAddressBooks: AddressBook[];
  page: number;
  contactsCount: number;
  baseUrl: string;
  search?: string;
}) {
  return html`
    <main id="main">
      <section id="contacts">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import Contacts from '/public/components/contacts/Contacts.js';

    const contactsElement = document.getElementById('contacts');

    if (contactsElement) {
      const contactsApp = h(Contacts, {
        initialAddressBookId: ${JSON.stringify(addressBookId || [])},
        initialContacts: ${JSON.stringify(userContacts || [])},
        initialAddressBooks: ${JSON.stringify(userAddressBooks || [])},
        baseUrl: ${JSON.stringify(baseUrl)},
        page: ${JSON.stringify(page || 1)},
        contactsCount: ${JSON.stringify(contactsCount || 0)},
        search: ${JSON.stringify(search || '')},
      });

      render(contactsApp, contactsElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}

export default page({
  get,
  accessMode: 'user',
});
