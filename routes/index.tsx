import { RouteHandler } from 'fresh';

import { FreshContextState } from '/lib/types.ts';

interface Data {}

export const handler: RouteHandler<Data, FreshContextState> = {
  GET(context) {
    if (context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/dashboard` } });
    }

    return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
  },
};
