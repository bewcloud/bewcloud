import { FreshContextState } from '/lib/types.ts';
import { Contact, ContactModel } from '/lib/models/contacts.ts';

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

    const requestBody = await request.clone().json() as RequestBody;

    if (!requestBody.addressBookId) {
      return new Response('Bad request', { status: 400 });
    }

    const contacts = await ContactModel.list(context.state.user.id, requestBody.addressBookId);

    const responseBody: ResponseBody = { success: true, contacts };

    return new Response(JSON.stringify(responseBody));
  },
};
