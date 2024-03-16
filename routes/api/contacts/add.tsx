import { Handlers } from 'fresh/server.ts';

import { Contact, FreshContextState } from '/lib/types.ts';
import { createContact, getContacts } from '/lib/data/contacts.ts';

interface Data {}

export interface RequestBody {
  firstName: string;
  lastName: string;
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

    if (requestBody.firstName) {
      const contact = await createContact(context.state.user.id, requestBody.firstName, requestBody.lastName);

      if (!contact) {
        return new Response('Not found', { status: 404 });
      }
    }

    const contacts = await getContacts(context.state.user.id, requestBody.page - 1);

    const responseBody: ResponseBody = { success: true, contacts };

    return new Response(JSON.stringify(responseBody));
  },
};
