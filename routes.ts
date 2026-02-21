import { serveFile } from '@std/http/file-server';

import { isRunningLocally as isAppRunningLocally } from '/public/ts/utils/misc.ts';
import { serveFileWithSass, serveFileWithTs } from '/lib/utils/misc.ts';
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

        const {
          get,
          post,
          put,
          patch,
          delete: deleteAction,
          options,
          copy,
          move,
          mkcol,
          lock,
          unlock,
          propfind,
          proppatch,
          report,
        } = page;

        const { user, session, tokenData } = (await getDataFromRequest(request)) || {};

        switch (request.method) {
          case 'GET':
          case 'HEAD':
          case 'OPTIONS':
            if (options) {
              return await options({
                request,
                match,
                user,
                session: { userSession: session, tokenData },
                isRunningLocally,
              });
            }

            if (get) {
              if (request.method === 'OPTIONS') {
                const allowedMethods = ['GET', 'HEAD', 'OPTIONS'];
                if (post) {
                  allowedMethods.push('POST');
                }
                if (put) {
                  allowedMethods.push('PUT');
                }
                if (patch) {
                  allowedMethods.push('PATCH');
                }
                if (deleteAction) {
                  allowedMethods.push('DELETE');
                }

                return new Response(null, {
                  status: 204,
                  headers: {
                    Allow: allowedMethods.join(', '),
                  },
                });
              }

              const response = await get({
                request,
                match,
                user,
                session: {
                  userSession: session,
                  tokenData,
                },
                isRunningLocally,
              });

              if (request.method === 'HEAD') {
                return new Response(null, {
                  status: response.status,
                  headers: response.headers,
                });
              }

              return response;
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
          case 'PUT':
            if (put) {
              return await put({
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
          case 'COPY':
            if (copy) {
              return await copy({
                request,
                match,
                user,
                session: { userSession: session, tokenData },
                isRunningLocally,
              });
            }
            break;
          case 'MOVE':
            if (move) {
              return await move({
                request,
                match,
                user,
                session: { userSession: session, tokenData },
                isRunningLocally,
              });
            }
            break;
          case 'MKCOL':
            if (mkcol) {
              return await mkcol({
                request,
                match,
                user,
                session: { userSession: session, tokenData },
                isRunningLocally,
              });
            }
            break;
          case 'LOCK':
            if (lock) {
              return await lock({
                request,
                match,
                user,
                session: { userSession: session, tokenData },
                isRunningLocally,
              });
            }
            break;
          case 'UNLOCK':
            if (unlock) {
              return await unlock({
                request,
                match,
                user,
                session: { userSession: session, tokenData },
                isRunningLocally,
              });
            }
            break;
          case 'PROPFIND':
            if (propfind) {
              return await propfind({
                request,
                match,
                user,
                session: { userSession: session, tokenData },
                isRunningLocally,
              });
            }
            break;
          case 'PROPPATCH':
            if (proppatch) {
              return await proppatch({
                request,
                match,
                user,
                session: { userSession: session, tokenData },
                isRunningLocally,
              });
            }
            break;
          case 'REPORT':
            if (report) {
              return await report({
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
        const fullFilePath = `public/${decodeURIComponent(filePath!)}`;

        const fileExtension = filePath!.split('.').pop()?.toLowerCase();

        let response: Response;

        if (fileExtension === 'ts') {
          response = await serveFileWithTs(request, fullFilePath);
        } else if (fileExtension === 'scss') {
          response = await serveFileWithSass(request, fullFilePath);
        } else {
          response = await serveFile(request, fullFilePath);

          if (filePath?.startsWith('js/')) {
            response.headers.set('content-type', 'application/javascript; charset=utf-8');
          }
        }

        response.headers.set('cache-control', `max-age=${oneDayInSeconds}, public`);
        return response;
      } catch (error) {
        if ((error as Error).toString().includes('NotFound')) {
          const notFoundPage: Page = (await import(`/pages/404.ts`)).default;

          const response = await notFoundPage.get!({
            request,
            match,
            isRunningLocally: false,
          });

          return new Response(response.body, {
            status: 404,
            headers: response.headers,
          });
        }

        console.error(error);

        return new Response('Internal Server Error', { status: 500 });
      }
    },
  },

  index: createPageRouteHandler('index.ts', '/'),
  login: createPageRouteHandler('login.tsx', '/login'),
  signup: createPageRouteHandler('signup.ts', '/signup'),
  logout: createPageRouteHandler('logout.ts', '/logout'),
  caldav: createPageRouteHandler('caldav.ts', '/caldav/:path*{/}?'),
  calendar: createPageRouteHandler('calendar.ts', '/calendar'),
  calendars: createPageRouteHandler('calendars.ts', '/calendars'),
  calendarEvent: createPageRouteHandler('calendar/[calendarEventId].ts', '/calendar/:calendarEventId'),
  carddav: createPageRouteHandler('carddav.ts', '/carddav/:path*{/}?'),
  contacts: createPageRouteHandler('contacts.ts', '/contacts'),
  contact: createPageRouteHandler('contacts/[contactId].ts', '/contacts/:contactId'),
  dashboard: createPageRouteHandler('dashboard.ts', '/dashboard'),
  dav: createPageRouteHandler('dav.ts', '/dav/:filePath*{/}?'),
  expenses: createPageRouteHandler('expenses.ts', '/expenses'),
  openFileShare: createPageRouteHandler(
    'file-share/[fileShareId]/open/[fileName].ts',
    '/file-share/:fileShareId/open/:fileName',
  ),
  verifyFileShare: createPageRouteHandler('file-share/[fileShareId]/verify.tsx', '/file-share/:fileShareId/verify'),
  fileShare: createPageRouteHandler('file-share/[fileShareId].ts', '/file-share/:fileShareId'),
  files: createPageRouteHandler('files.ts', '/files'),
  openFile: createPageRouteHandler('files/open/[fileName].ts', '/files/open/:fileName'),
  mfaVerify: createPageRouteHandler('mfa-verify.tsx', '/mfa-verify'),
  news: createPageRouteHandler('news.ts', '/news'),
  newsFeeds: createPageRouteHandler('news/feeds.ts', '/news/feeds'),
  notes: createPageRouteHandler('notes.ts', '/notes'),
  openNote: createPageRouteHandler('notes/open/[fileName].ts', '/notes/open/:fileName'),
  oidcCallback: createPageRouteHandler('oidc/callback.ts', '/oidc/callback'),
  photos: createPageRouteHandler('photos.ts', '/photos'),
  photoThumbnail: createPageRouteHandler('photos/thumbnail/[fileName].ts', '/photos/thumbnail/:fileName'),
  settings: createPageRouteHandler('settings.ts', '/settings'),

  wellKnownCalDav: createPageRouteHandler('.well-known/caldav.ts', '/.well-known/caldav'),
  wellKnownCardDav: createPageRouteHandler('.well-known/carddav.ts', '/.well-known/carddav'),

  // API routes
  apiAuthMultiFactorEmailSetup: createPageRouteHandler(
    'api/auth/multi-factor/email/setup.ts',
    '/api/auth/multi-factor/email/setup',
  ),
  apiAuthMultiFactorPasskeyBegin: createPageRouteHandler(
    'api/auth/multi-factor/passkey/begin.ts',
    '/api/auth/multi-factor/passkey/begin',
  ),
  apiAuthMultiFactorPasskeySetupBegin: createPageRouteHandler(
    'api/auth/multi-factor/passkey/setup-begin.ts',
    '/api/auth/multi-factor/passkey/setup-begin',
  ),
  apiAuthMultiFactorPasskeySetupComplete: createPageRouteHandler(
    'api/auth/multi-factor/passkey/setup-complete.ts',
    '/api/auth/multi-factor/passkey/setup-complete',
  ),
  apiAuthMultiFactorPasskeyVerify: createPageRouteHandler(
    'api/auth/multi-factor/passkey/verify.ts',
    '/api/auth/multi-factor/passkey/verify',
  ),
  apiAuthMultiFactorTotpSetup: createPageRouteHandler(
    'api/auth/multi-factor/totp/setup.ts',
    '/api/auth/multi-factor/totp/setup',
  ),
  apiAuthMultiFactorDisable: createPageRouteHandler(
    'api/auth/multi-factor/disable.ts',
    '/api/auth/multi-factor/disable',
  ),
  apiAuthMultiFactorEnable: createPageRouteHandler('api/auth/multi-factor/enable.ts', '/api/auth/multi-factor/enable'),

  apiCalendarAddEvent: createPageRouteHandler('api/calendar/add-event.ts', '/api/calendar/add-event'),
  apiCalendarAdd: createPageRouteHandler('api/calendar/add.ts', '/api/calendar/add'),
  apiCalendarDeleteEvent: createPageRouteHandler('api/calendar/delete-event.ts', '/api/calendar/delete-event'),
  apiCalendarDelete: createPageRouteHandler('api/calendar/delete.ts', '/api/calendar/delete'),
  apiCalendarExportEvents: createPageRouteHandler('api/calendar/export-events.ts', '/api/calendar/export-events'),
  apiCalendarImport: createPageRouteHandler('api/calendar/import.ts', '/api/calendar/import'),
  apiCalendarSearchEvents: createPageRouteHandler('api/calendar/search-events.ts', '/api/calendar/search-events'),
  apiCalendarUpdate: createPageRouteHandler('api/calendar/update.ts', '/api/calendar/update'),

  apiContactsAddAddressBook: createPageRouteHandler('api/contacts/add-addressbook.ts', '/api/contacts/add-addressbook'),
  apiContactsAdd: createPageRouteHandler('api/contacts/add.ts', '/api/contacts/add'),
  apiContactsDeleteAddressBook: createPageRouteHandler(
    'api/contacts/delete-addressbook.ts',
    '/api/contacts/delete-addressbook',
  ),
  apiContactsDelete: createPageRouteHandler('api/contacts/delete.ts', '/api/contacts/delete'),
  apiContactsGetAddressBooks: createPageRouteHandler(
    'api/contacts/get-addressbooks.ts',
    '/api/contacts/get-addressbooks',
  ),
  apiContactsGet: createPageRouteHandler('api/contacts/get.ts', '/api/contacts/get'),
  apiContactsImport: createPageRouteHandler('api/contacts/import.ts', '/api/contacts/import'),

  apiDashboardSaveLinks: createPageRouteHandler('api/dashboard/save-links.ts', '/api/dashboard/save-links'),
  apiDashboardSaveNotes: createPageRouteHandler('api/dashboard/save-notes.ts', '/api/dashboard/save-notes'),

  apiExpensesAddBudget: createPageRouteHandler('api/expenses/add-budget.ts', '/api/expenses/add-budget'),
  apiExpensesAddExpense: createPageRouteHandler('api/expenses/add-expense.ts', '/api/expenses/add-expense'),
  apiExpensesAutoComplete: createPageRouteHandler('api/expenses/auto-complete.ts', '/api/expenses/auto-complete'),
  apiExpensesDeleteBudget: createPageRouteHandler('api/expenses/delete-budget.ts', '/api/expenses/delete-budget'),
  apiExpensesDeleteExpense: createPageRouteHandler('api/expenses/delete-expense.ts', '/api/expenses/delete-expense'),
  apiExpensesExportExpenses: createPageRouteHandler('api/expenses/export-expenses.ts', '/api/expenses/export-expenses'),
  apiExpensesImportExpenses: createPageRouteHandler('api/expenses/import-expenses.ts', '/api/expenses/import-expenses'),
  apiExpensesUpdateBudget: createPageRouteHandler('api/expenses/update-budget.ts', '/api/expenses/update-budget'),
  apiExpensesUpdateExpense: createPageRouteHandler('api/expenses/update-expense.ts', '/api/expenses/update-expense'),

  apiFilesCreateDirectory: createPageRouteHandler('api/files/create-directory.ts', '/api/files/create-directory'),
  apiFilesCreateShare: createPageRouteHandler('api/files/create-share.ts', '/api/files/create-share'),
  apiFilesDeleteDirectory: createPageRouteHandler('api/files/delete-directory.ts', '/api/files/delete-directory'),
  apiFilesDeleteShare: createPageRouteHandler('api/files/delete-share.ts', '/api/files/delete-share'),
  apiFilesDelete: createPageRouteHandler('api/files/delete.ts', '/api/files/delete'),
  apiFilesDownloadDirectory: createPageRouteHandler('api/files/download-directory.ts', '/api/files/download-directory'),
  apiFilesGetDirectories: createPageRouteHandler('api/files/get-directories.ts', '/api/files/get-directories'),
  apiFilesGetShare: createPageRouteHandler('api/files/get-share.ts', '/api/files/get-share'),
  apiFilesGet: createPageRouteHandler('api/files/get.ts', '/api/files/get'),
  apiFilesMoveDirectory: createPageRouteHandler('api/files/move-directory.ts', '/api/files/move-directory'),
  apiFilesMove: createPageRouteHandler('api/files/move.ts', '/api/files/move'),
  apiFilesRenameDirectory: createPageRouteHandler('api/files/rename-directory.ts', '/api/files/rename-directory'),
  apiFilesRename: createPageRouteHandler('api/files/rename.ts', '/api/files/rename'),
  apiFilesSearch: createPageRouteHandler('api/files/search.ts', '/api/files/search'),
  apiFilesUpdateShare: createPageRouteHandler('api/files/update-share.ts', '/api/files/update-share'),
  apiFilesUpload: createPageRouteHandler('api/files/upload.ts', '/api/files/upload'),

  apiNewsAddFeed: createPageRouteHandler('api/news/add-feed.ts', '/api/news/add-feed'),
  apiNewsDeleteFeed: createPageRouteHandler('api/news/delete-feed.ts', '/api/news/delete-feed'),
  apiNewsImportFeeds: createPageRouteHandler('api/news/import-feeds.ts', '/api/news/import-feeds'),
  apiNewsMarkRead: createPageRouteHandler('api/news/mark-read.ts', '/api/news/mark-read'),
  apiNewsRefreshArticles: createPageRouteHandler('api/news/refresh-articles.ts', '/api/news/refresh-articles'),

  apiNotesSave: createPageRouteHandler('api/notes/save.ts', '/api/notes/save'),
};

export default routes;
