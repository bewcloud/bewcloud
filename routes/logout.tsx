import { RouteHandler } from 'fresh';

import { logoutUser } from '/lib/auth.ts';
import { FreshContextState } from '/lib/types.ts';

interface Data {}

export const handler: RouteHandler<Data, FreshContextState> = {
  async GET(context) {
    const request = context.req;

    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    return await logoutUser(request);
  },
};
