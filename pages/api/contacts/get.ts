import page, { RequestHandlerParams } from '/lib/page.ts';

import { Contact, ContactModel } from '/lib/models/contacts.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
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

  if (!requestBody.addressBookId) {
    return new Response('Bad request', { status: 400 });
  }

  const contacts = await ContactModel.list(user!.id, requestBody.addressBookId);

  const responseBody: ResponseBody = { success: true, contacts };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
