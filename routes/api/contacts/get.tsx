import { Handlers } from 'fresh/server.ts';

import { Contact, FreshContextState } from '/lib/types.ts';
import { getAllContacts } from '/lib/data/contacts.ts';

interface Data {}

export interface RequestBody {}

export interface ResponseBody {
  success: boolean;
  contacts: Contact[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const contacts = await getAllContacts(context.state.user.id);

    const responseBody: ResponseBody = { success: true, contacts };

    return new Response(JSON.stringify(responseBody));
  },
};
