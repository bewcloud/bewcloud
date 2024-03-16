import { Handlers } from 'fresh/server.ts';

import { logoutUser } from '/lib/auth.ts';
import { FreshContextState } from '/lib/types.ts';

interface Data {}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    return await logoutUser(request);
  },
};
