import { Handlers, PageProps } from 'fresh/server.ts';

import { Contact, FreshContextState } from '/lib/types.ts';
import { getContacts, getContactsCount, searchContacts, searchContactsCount } from '/lib/data/contacts.ts';
import Contacts from '/islands/contacts/Contacts.tsx';

interface Data {
  userContacts: Pick<Contact, 'id' | 'first_name' | 'last_name'>[];
  page: number;
  contactsCount: number;
  search?: string;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const searchParams = new URL(request.url).searchParams;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const search = searchParams.get('search') || undefined;

    const userContacts = search
      ? await searchContacts(search, context.state.user.id, page - 1)
      : await getContacts(context.state.user.id, page - 1);

    const contactsCount = search
      ? await searchContactsCount(search, context.state.user.id)
      : await getContactsCount(context.state.user.id);

    return await context.render({ userContacts, page, contactsCount, search });
  },
};

export default function ContactsPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <Contacts
        initialContacts={data?.userContacts || []}
        page={data?.page || 1}
        contactsCount={data?.contactsCount || 0}
        search={data?.search || ''}
      />
    </main>
  );
}
