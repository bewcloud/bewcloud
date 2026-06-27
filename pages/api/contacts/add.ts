import page, { RequestHandlerParams } from '/lib/page.ts';

import { Contact, ContactModel } from '/lib/models/contacts.ts';
import { generateVCard } from '/public/ts/utils/contacts.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  firstName: string;
  lastName?: string;
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

  if (!requestBody.firstName || !requestBody.addressBookId) {
    return new Response('Bad request', { status: 400 });
  }

  const userId = user!.id;

  const contactId = crypto.randomUUID();

  const vCard = generateVCard(contactId, requestBody.firstName, requestBody.lastName);

  await ContactModel.create(userId, requestBody.addressBookId, contactId, vCard);

  const contacts = await ContactModel.list(userId, requestBody.addressBookId);

  const responseBody: ResponseBody = { success: true, contacts };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
