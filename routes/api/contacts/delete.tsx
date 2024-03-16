import { Handlers } from 'fresh/server.ts';

import { Contact, FreshContextState } from '/lib/types.ts';
import { deleteContact, getContact, getContacts } from '/lib/data/contacts.ts';

interface Data {}

export interface RequestBody {
  contactId: string;
  page: number;
}

export interface ResponseBody {
  success: boolean;
  contacts: Pick<Contact, 'id' | 'first_name' | 'last_name'>[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (requestBody.contactId) {
      const contact = await getContact(requestBody.contactId, context.state.user.id);

      if (!contact) {
        return new Response('Not found', { status: 404 });
      }

      await deleteContact(requestBody.contactId, context.state.user.id);
    }

    const contacts = await getContacts(context.state.user.id, requestBody.page - 1);

    const responseBody: ResponseBody = { success: true, contacts };

    return new Response(JSON.stringify(responseBody));
  },
};
