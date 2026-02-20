import page, { RequestHandlerParams } from '/lib/page.ts';

import { AddressBook, ContactModel } from '/lib/models/contacts.ts';
import { AppConfig } from '/lib/config.ts';

export interface ResponseBody {
  success: boolean;
  addressBooks: AddressBook[];
}

async function post({ user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('contacts'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const addressBooks = await ContactModel.listAddressBooks(user!.id);

  const responseBody: ResponseBody = { success: true, addressBooks };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
