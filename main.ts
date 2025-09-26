import routes, { Route } from './routes.ts';
import { startCrons } from './crons/index.ts';
import { Page } from './lib/page.ts';

const MAX_REQUEST_SIZE_IN_MEGABYTES = 12;
const MAX_REQUEST_SIZE_IN_BYTES = MAX_REQUEST_SIZE_IN_MEGABYTES * 1024 * 1024;

async function handler(request: Request) {
  const contentLength = request.headers.get('content-length');

  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE_IN_BYTES) {
    return new Response('Payload too large', { status: 413 });
  }

  const routeKeys = Object.keys(routes);

  for (const routeKey of routeKeys) {
    const route: Route = routes[routeKey];
    const match = route.pattern.exec(request.url);

    if (match) {
      return route.handler(request, match);
    }
  }

  const notFoundPage: Page = (await import(`/pages/404.ts`)).default;

  const response = await notFoundPage.get!({
    request,
    match: new URLPattern({ pathname: '/' }).exec(request.url) as URLPatternResult,
    isRunningLocally: false,
  });

  return new Response(response.body, {
    status: 404,
    headers: response.headers,
  });
}

export const abortController = new AbortController();

const PORT = Deno.env.get('PORT') || 8000;

Deno.serve({ port: PORT as number, signal: abortController.signal }, handler);

startCrons();
