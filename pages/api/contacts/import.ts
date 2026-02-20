import page, { RequestHandlerParams } from '/lib/page.ts';

import { Contact, ContactModel } from '/lib/models/contacts.ts';
import { concurrentPromises } from '/public/ts/utils/misc.ts';
import { getIdFromVCard, splitTextIntoVCards } from '/public/ts/utils/contacts.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  vCards: string;
  addressBookId: string;
}

export interface ResponseBody {
  success: boolean;
  contacts: Contact[];
}

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('contacts'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (!requestBody.vCards || !requestBody.addressBookId) {
    return new Response('Bad request', { status: 400 });
  }

  const userId = user!.id;

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
}

export default page({
  post,
  accessMode: 'user',
});
