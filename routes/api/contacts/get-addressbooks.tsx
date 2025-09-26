import { RouteHandler } from 'fresh';

import { FreshContextState } from '/lib/types.ts';
import { AddressBook, ContactModel } from '/lib/models/contacts.ts';

interface Data {}

export interface RequestBody {}

export interface ResponseBody {
  success: boolean;
  addressBooks: AddressBook[];
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async POST(context) {
    const request = context.req;

    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const addressBooks = await ContactModel.listAddressBooks(context.state.user.id);

    const responseBody: ResponseBody = { success: true, addressBooks };

    return new Response(JSON.stringify(responseBody));
  },
};
