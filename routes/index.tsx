import { Handlers } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';

interface Data {}

export const handler: Handlers<Data, FreshContextState> = {
  GET(request, context) {
    if (context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/dashboard` } });
    }

    return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
  },
};
