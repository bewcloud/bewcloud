import { Handlers } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { Contact, ContactModel } from '/lib/models/contacts.ts';
import { concurrentPromises } from '/lib/utils/misc.ts';
import { getIdFromVCard, splitTextIntoVCards } from '/lib/utils/contacts.ts';

interface Data {}

export interface RequestBody {
  vCards: string;
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

    if (!requestBody.vCards || !requestBody.addressBookId) {
      return new Response('Bad request', { status: 400 });
    }

    const userId = context.state.user.id;

    const vCards = splitTextIntoVCards(requestBody.vCards);

    await concurrentPromises(
      vCards.map((vCard) => async () => {
        const contactId = getIdFromVCard(vCard);

        await ContactModel.create(userId, requestBody.addressBookId, contactId, vCard);
      }),
      5,
    );

    const contacts = await ContactModel.list(userId, requestBody.addressBookId);

    const responseBody: ResponseBody = { success: true, contacts };

    return new Response(JSON.stringify(responseBody));
  },
};
