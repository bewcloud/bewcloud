import { Handler, RouteConfig } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';

interface Data {}

export const config: RouteConfig = {
  routeOverride: '/caldav/:path*',
};

export const handler: Handler<Data, FreshContextState> = async (request, context) => {
  const calendarConfig = await AppConfig.getCalendarConfig();

  if (!calendarConfig.enableCalDavServer) {
    return new Response('Not Found', { status: 404 });
  }

  if (!context.state.user) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'www-authenticate': 'Basic realm="bewCloud", charset="UTF-8"' },
    });
  }

  const { path } = context.params;

  const userId = context.state.user.id;

  try {
    const requestBodyText = await request.clone().text();

    // Remove the `/caldav/` prefix from the hrefs in the request
    const parsedRequestBodyText = requestBodyText.replaceAll('<href>/caldav/', `<href>/`).replaceAll(
      ':href>/caldav/',
      `:href>/`,
    );

    const response = await fetch(`${calendarConfig.calDavUrl}/${path}`, {
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        'X-Remote-User': `${userId}`,
      },
      method: request.method,
      body: parsedRequestBodyText,
    });

    if (response.status === 204) {
      return new Response(null, { status: 204 });
    }

    const responseBodyText = await response.clone().text();

    // Add the `/caldav/` prefix to the hrefs in the response
    const parsedBodyResponseText = responseBodyText.replaceAll('<href>/', `<href>/caldav/`).replaceAll(
      ':href>/',
      `:href>/caldav/`,
    );

    return new Response(parsedBodyResponseText, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error(error);
  }

  return new Response(null, { status: 405 });
};
