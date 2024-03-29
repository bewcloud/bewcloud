import { Handlers } from 'fresh/server.ts';

import { Contact, FreshContextState } from '/lib/types.ts';
import { concurrentPromises } from '/lib/utils/misc.ts';
import { createContact, getContacts, updateContact } from '/lib/data/contacts.ts';

interface Data {}

export interface RequestBody {
  partialContacts: Partial<Contact>[];
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

    if (requestBody.partialContacts) {
      if (requestBody.partialContacts.length === 0) {
        return new Response('Not found', { status: 404 });
      }

      await concurrentPromises(
        requestBody.partialContacts.map((partialContact) => async () => {
          if (partialContact.first_name) {
            const contact = await createContact(
              context.state.user!.id,
              partialContact.first_name,
              partialContact.last_name || '',
            );

            const parsedExtra = JSON.stringify(partialContact.extra || {});

            if (parsedExtra !== '{}') {
              contact.extra = partialContact.extra!;

              await updateContact(contact);
            }
          }
        }),
        5,
      );
    }

    const contacts = await getContacts(context.state.user.id, requestBody.page - 1);

    const responseBody: ResponseBody = { success: true, contacts };

    return new Response(JSON.stringify(responseBody));
  },
};
