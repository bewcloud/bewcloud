import { serveFile } from 'std/http/file-server';

import { isRunningLocally as isAppRunningLocally, serveFileWithSass, serveFileWithTs } from './lib/utils/misc.ts';
import { getDataFromRequest } from '/lib/auth.ts';
import { Page } from '/lib/page.ts';

export interface Route {
  pattern: URLPattern;
  handler: (
    request: Request,
    match: URLPatternResult,
  ) => Response | Promise<Response>;
}

interface Routes {
  [routeKey: string]: Route;
}

function createPageRouteHandler(id: string, pathname: string) {
  return {
    pattern: new URLPattern({ pathname }),
    handler: async (request: Request, match: URLPatternResult) => {
      try {
        const page: Page = (await import(`/pages/${id}`)).default;

        const isRunningLocally = isAppRunningLocally(request);

        const { get, post, patch, delete: deleteAction } = page;

        const { user, session, tokenData } = (await getDataFromRequest(request)) || {};

        switch (request.method) {
          case 'GET':
            if (get) {
              return await get({
                request,
                match,
                user,
                session: { userSession: session, tokenData },
                isRunningLocally,
              });
            }
            break;
          case 'POST':
            if (post) {
              return await post({
                request,
                match,
                user,
                session: { userSession: session, tokenData },
                isRunningLocally,
              });
            }
            break;
          case 'PATCH':
            if (patch) {
              return await patch({
                request,
                match,
                user,
                session: { userSession: session, tokenData },
                isRunningLocally,
              });
            }
            break;
          case 'DELETE':
            if (deleteAction) {
              return await deleteAction({
                request,
                match,
                user,
                session: { userSession: session, tokenData },
                isRunningLocally,
              });
            }
            break;
          default:
            return new Response('Not Implemented', { status: 501 });
        }

        return new Response('Not Implemented', { status: 501 });
      } catch (error) {
        if ((error as Error).toString().includes('NotFound')) {
          const notFoundPage: Page = (await import(`/pages/404.ts`)).default;

          const response = await notFoundPage.get!({ request, match, isRunningLocally: false });

          return new Response(response.body, {
            status: 404,
            headers: response.headers,
          });
        }

        console.error(error);

        return new Response('Internal Server Error', { status: 500 });
      }
    },
  };
}

const oneDayInSeconds = 24 * 60 * 60;

const routes: Routes = {
  robots: {
    pattern: new URLPattern({ pathname: '/robots.txt' }),
    handler: async (request) => {
      const response = await serveFile(request, `public/robots.txt`);
      response.headers.set('cache-control', `max-age=${oneDayInSeconds}, public`);
      return response;
    },
  },
  favicon: {
    pattern: new URLPattern({ pathname: '/favicon.ico' }),
    handler: async (request) => {
      const response = await serveFile(request, `public/images/favicon.ico`);
      response.headers.set('cache-control', `max-age=${oneDayInSeconds}, public`);
      return response;
    },
  },
  public: {
    pattern: new URLPattern({ pathname: '/public/:filePath*' }),
    handler: async (request, match) => {
      const { filePath } = match.pathname.groups;

      try {
        const fullFilePath = `public/${filePath}`;

        const fileExtension = filePath!.split('.').pop()?.toLowerCase();

        let response: Response;

        if (fileExtension === 'ts') {
          response = await serveFileWithTs(request, fullFilePath);
        } else if (fileExtension === 'scss') {
          response = await serveFileWithSass(request, fullFilePath);
        } else {
          response = await serveFile(request, `public/${filePath}`);
        }

        response.headers.set('cache-control', `max-age=${oneDayInSeconds}, public`);
        return response;
      } catch (error) {
        if ((error as Error).toString().includes('NotFound')) {
          return new Response('Not Found', { status: 404 });
        }

        console.error(error);

        return new Response('Internal Server Error', { status: 500 });
      }
    },
  },

  index: createPageRouteHandler('index.tsx', '/'),
  login: createPageRouteHandler('login.tsx', '/login'),
  dashboard: createPageRouteHandler('dashboard.tsx', '/dashboard'),

  // API routes
  apiDashboardSaveLinks: createPageRouteHandler('api/dashboard/save-links.ts', '/api/dashboard/save-links'),
  apiDashboardSaveNotes: createPageRouteHandler('api/dashboard/save-notes.ts', '/api/dashboard/save-notes'),
  // machinesPhoto: createPageRouteHandler('machines/photo', '/machines/photos/:machineId/:photoId'),
  // machinesView: createPageRouteHandler('machines/view', '/machines/:categorySlug/:machineSlug'),
  // machinesIndex: createPageRouteHandler('machines/index', '/machines/:categorySlug'),
};

export default routes;
