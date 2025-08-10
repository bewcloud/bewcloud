import { Handlers } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { Contact, ContactModel } from '/lib/models/contacts.ts';
import { generateVCard } from '/lib/utils/contacts.ts';

interface Data {}

export interface RequestBody {
  firstName: string;
  lastName?: string;
  addressBookId: string;
}

export interface ResponseBody {
  success: boolean;
  contacts: Contact[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (!requestBody.firstName || !requestBody.addressBookId) {
      return new Response('Bad request', { status: 400 });
    }

    const userId = context.state.user.id;

    const contactId = crypto.randomUUID();

    const vCard = generateVCard(contactId, requestBody.firstName, requestBody.lastName);

    await ContactModel.create(userId, requestBody.addressBookId, contactId, vCard);

    const contacts = await ContactModel.list(userId, requestBody.addressBookId);

    const responseBody: ResponseBody = { success: true, contacts };

    return new Response(JSON.stringify(responseBody));
  },
};
