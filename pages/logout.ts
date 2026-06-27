import page, { RequestHandlerParams } from '/lib/page.ts';

import { logoutUser } from '/lib/auth.ts';

async function get({ request }: RequestHandlerParams) {
  return await logoutUser(request);
}

export default page({
  get,
  accessMode: 'user',
});
