import { RouteHandler } from 'fresh';

import { FreshContextState } from '/lib/types.ts';

interface Data {}

export const handler: RouteHandler<Data, FreshContextState> = () => {
  return new Response('Redirecting...', { status: 301, headers: { 'Location': '/carddav' } });
};
