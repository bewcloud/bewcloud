import routes, { Route } from './routes.ts';
import { startCrons } from './crons/index.ts';
import { Page } from './lib/page.ts';

const MAX_REQUEST_SIZE_IN_MEGABYTES = 12;
const MAX_REQUEST_SIZE_IN_BYTES = MAX_REQUEST_SIZE_IN_MEGABYTES * 1024 * 1024;

function applyCorsHeadersToResponse(origin: string, response: Response) {
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
  if (!headers.get('content-security-policy')) {
    headers.set(
      'Content-Security-Policy',
      "default-src 'self'; child-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
    );
  }
  if (!headers.get('x-frame-options')) {
    headers.set('X-Frame-Options', 'DENY');
  }
  if (!headers.get('x-content-type-options')) {
    headers.set('X-Content-Type-Options', 'nosniff');
  }
  if (!headers.get('strict-transport-security')) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

function handleLogging(request: Request, response: Response) {
  console.info(`${new Date().toISOString()} - [${response.status}] ${request.method} ${request.url}`);
  // NOTE: Uncomment when debugging WebDav/CardDav/CalDav stuff
  // if (request.url.includes('/dav') || request.url.includes('/carddav') || request.url.includes('/caldav')) {
  //   console.info(`Request`, request.headers);
  //   try {
  //     console.info((await request.clone().text()) || '<No Body>');
  //   } catch (_error) {
  //     console.info('<No Body>');
  //   }
  //   console.info(`Response`, response.headers);
  //   console.info(`Status`, response.status);
  // }

  return response;
}

async function handler(request: Request) {
  const contentLength = request.headers.get('content-length');

  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE_IN_BYTES) {
    return new Response('Payload too large', { status: 413 });
  }

  const path = new URL(request.url).pathname;
  const origin = request.headers.get('Origin') || '*';

  // CORS headers for non-DAV routes
  if (
    request.method == 'OPTIONS' && path !== '/dav' && !path.startsWith('/dav/') && path !== '/carddav' &&
    !path.startsWith('/carddav/') && path !== '/caldav' && !path.startsWith('/caldav/')
  ) {
    const response = new Response(null, {
      status: 204,
    });
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

  const routeKeys = Object.keys(routes);

  for (const routeKey of routeKeys) {
    const route: Route = routes[routeKey];
    const match = route.pattern.exec(request.url);

    if (match) {
      const response = await route.handler(request, match);

      applyCorsHeadersToResponse(origin, response);
      handleLogging(request, response);

      return response;
    }
  }

  const notFoundPage: Page = (await import(`/pages/404.ts`)).default;

  const response = await notFoundPage.get!({
    request,
    match: new URLPattern({ pathname: '/' }).exec(request.url) as URLPatternResult,
    isRunningLocally: false,
  });

  handleLogging(request, response);

  return new Response(response.body, {
    status: 404,
    headers: response.headers,
  });
}

async function notifyServiceManagerReady() {
  const socketAddress = Deno.env.get('NOTIFY_SOCKET');
  if (typeof socketAddress !== 'string') {
    return;
  }

  const result = await (new Deno.Command('systemd-notify', {
    args: ['--ready', `MESSAGE=bewCloud is ready`],
  })).output();
  if (!result.success) {
    const output = new TextDecoder().decode(result.stderr);
    throw new Deno.errors.NotCapable(`Failed to execute “systemd-notify”: ${output} (code ${result.code})`);
  }
}

export const abortController = new AbortController();

const PORT = Deno.env.get('PORT') || 8000;

Deno.serve({ port: PORT as number, signal: abortController.signal }, handler);

startCrons();
notifyServiceManagerReady();
