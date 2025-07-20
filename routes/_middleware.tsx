import { FreshContext } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { getDataFromRequest } from '/lib/auth.ts';

export const handler = [
  async function handleCors(request: Request, context: FreshContext<FreshContextState>) {
    const path = new URL(request.url).pathname;

    if (
      request.method == 'OPTIONS' && path !== '/dav' && !path.startsWith('/dav/') && path !== '/carddav' &&
      !path.startsWith('/carddav/') && path !== '/caldav' && !path.startsWith('/caldav/')
    ) {
      const response = new Response(null, {
        status: 204,
      });
      const origin = request.headers.get('Origin') || '*';
      const headers = response.headers;
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, PUT, DELETE');
      headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With',
      );
      return response;
    }

    const origin = request.headers.get('Origin') || '*';
    const response = await context.next();
    const headers = response.headers;

    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With',
    );
    headers.set(
      'Access-Control-Allow-Methods',
      'POST, OPTIONS, GET, PUT, DELETE',
    );
    headers.set(
      'Content-Security-Policy',
      "default-src 'self'; child-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
    );
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    return response;
  },

  async function handleContextState(request: Request, context: FreshContext<FreshContextState>) {
    const { user, session } = (await getDataFromRequest(request)) || {};

    if (user) {
      context.state.user = user;
    }

    if (session) {
      context.state.session = session;
    }

    const response = await context.next();

    return response;
  },

  async function handleLogging(request: Request, context: FreshContext<FreshContextState>) {
    const response = await context.next();

    console.info(`${new Date().toISOString()} - [${response.status}] ${request.method} ${request.url}`);
    // NOTE: Uncomment when debugging WebDav/CardDav/CalDav stuff
    if (request.url.includes('/dav') || request.url.includes('/carddav') || request.url.includes('/caldav')) {
      console.info(`Request`, request.headers);
      try {
        console.info((await request.clone().text()) || '<No Body>');
      } catch (_error) {
        console.info('<No Body>');
      }
      console.info(`Response`, response.headers);
      console.info(`Status`, response.status);
    }

    return response;
  },
];
