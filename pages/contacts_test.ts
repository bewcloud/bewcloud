import { DOMParser } from '@b-fuze/deno-dom';
import { assert, assertEquals } from '@std/assert';

import { AppConfig } from '/lib/config.ts';
import { ContactModel } from '/lib/models/contacts.ts';
import { User } from '/lib/types.ts';

import contactsPage from './contacts.ts';

Deno.test('that address book names cannot inject scripts into the contacts page', async () => {
  const config = await AppConfig.getConfig();
  const previousCardDav = config.contacts.enableCardDavServer;
  const previousApps = config.core.enabledApps;
  const originalListAddressBooks = ContactModel.listAddressBooks;
  const originalList = ContactModel.list;
  const addressBooks = [
    {
      uid: 'contacts',
      url: 'http://radicale:5232/user/contacts/',
      displayName: '</script><script id=addressbook-injection>alert(1)</script>',
    },
    {
      uid: 'friends',
      url: 'http://radicale:5232/user/friends/',
      displayName: 'Família & Friends',
    },
  ];

  config.contacts.enableCardDavServer = true;
  config.core.enabledApps = ['contacts'];
  ContactModel.listAddressBooks = () => Promise.resolve(addressBooks);
  ContactModel.list = () => Promise.resolve([]);

  try {
    const request = new Request('http://localhost:8000/contacts');
    const match = new URLPattern({ pathname: '/contacts' }).exec(request.url)!;
    const user: User = {
      id: 'user',
      email: 'contacts@example.com',
      hashed_password: '',
      subscription: { external: {}, expires_at: '', updated_at: '' },
      status: 'active',
      extra: { is_email_verified: true },
      created_at: new Date(),
    };
    const response = await contactsPage.get!({ request, match, user, isRunningLocally: true });
    const document = new DOMParser().parseFromString(await response.text(), 'text/html')!;

    assertEquals(response.status, 200);
    assertEquals(document.querySelector('#addressbook-injection'), null);

    const contactsScript = Array.from(document.querySelectorAll('script')).find((script) =>
      script.textContent.includes('initialAddressBooks:')
    );
    const serializedAddressBooks = contactsScript?.textContent.match(/initialAddressBooks: (.*),/);

    assert(serializedAddressBooks);
    assertEquals(JSON.parse(serializedAddressBooks[1]), addressBooks);
  } finally {
    config.contacts.enableCardDavServer = previousCardDav;
    config.core.enabledApps = previousApps;
    ContactModel.listAddressBooks = originalListAddressBooks;
    ContactModel.list = originalList;
  }
});
