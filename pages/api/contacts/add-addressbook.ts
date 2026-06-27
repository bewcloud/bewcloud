import page, { RequestHandlerParams } from '/lib/page.ts';

import { AddressBook, ContactModel } from '/lib/models/contacts.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  name: string;
}

export interface ResponseBody {
  success: boolean;
  addressBooks: AddressBook[];
}

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('contacts'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (!requestBody.name) {
    return new Response('Bad request', { status: 400 });
  }

  const userId = user!.id;

  await ContactModel.createAddressBook(userId, requestBody.name);

  const addressBooks = await ContactModel.listAddressBooks(userId);

  const responseBody: ResponseBody = { success: true, addressBooks };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
