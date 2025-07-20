import { Handler } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';

interface Data {}

export const handler: Handler<Data, FreshContextState> = () => {
  return new Response('Redirecting...', { status: 301, headers: { 'Location': '/carddav' } });
};
