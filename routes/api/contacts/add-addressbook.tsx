import { Handlers } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { AddressBook, ContactModel } from '/lib/models/contacts.ts';

interface Data {}

export interface RequestBody {
  name: string;
}

export interface ResponseBody {
  success: boolean;
  addressBooks: AddressBook[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (!requestBody.name) {
      return new Response('Bad request', { status: 400 });
    }

    const userId = context.state.user.id;

    await ContactModel.createAddressBook(userId, requestBody.name);

    const addressBooks = await ContactModel.listAddressBooks(userId);

    const responseBody: ResponseBody = { success: true, addressBooks };

    return new Response(JSON.stringify(responseBody));
  },
};
