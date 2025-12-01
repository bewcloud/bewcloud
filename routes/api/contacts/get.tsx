import { Handlers } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { Contact, ContactModel } from '/lib/models/contacts.ts';
import { AppConfig } from '/lib/config.ts';

interface Data {}

export interface RequestBody {
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

    if (!(await AppConfig.isAppEnabled('contacts'))) {
      return new Response('Forbidden', { status: 403 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (!requestBody.addressBookId) {
      return new Response('Bad request', { status: 400 });
    }

    const contacts = await ContactModel.list(context.state.user.id, requestBody.addressBookId);

    const responseBody: ResponseBody = { success: true, contacts };

    return new Response(JSON.stringify(responseBody));
  },
};
