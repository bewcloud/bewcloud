import { Handlers } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { AddressBook, ContactModel } from '/lib/models/contacts.ts';
import { AppConfig } from '/lib/config.ts';

interface Data {}

export interface RequestBody {}

export interface ResponseBody {
  success: boolean;
  addressBooks: AddressBook[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!(await AppConfig.isAppEnabled('contacts'))) {
      return new Response('Forbidden', { status: 403 });
    }

    const addressBooks = await ContactModel.listAddressBooks(context.state.user.id);

    const responseBody: ResponseBody = { success: true, addressBooks };

    return new Response(JSON.stringify(responseBody));
  },
};
