import { User, UserSession } from './types.ts';
import { JwtData } from './auth.ts';

export type RequestHandlerParams = {
  request: Request;
  match: URLPatternResult;
  user?: User | null;
  session?: { userSession?: UserSession; tokenData?: JwtData['data'] } | null;
  isRunningLocally: boolean;
};
export type RequestHandler<T = Response> = (params: RequestHandlerParams) => T | Promise<T>;

export interface Page {
  get?: RequestHandler;
  post?: RequestHandler;
  put?: RequestHandler;
  patch?: RequestHandler;
  delete?: RequestHandler;
  options?: RequestHandler;
  copy?: RequestHandler;
  move?: RequestHandler;
  mkcol?: RequestHandler;
  mkcalendar?: RequestHandler;
  lock?: RequestHandler;
  unlock?: RequestHandler;
  propfind?: RequestHandler;
  proppatch?: RequestHandler;
  report?: RequestHandler;
}

type AccessMode = 'public' | 'user';
interface PermissionsParams {
  accessMode: AccessMode;
}

type Params = Page & PermissionsParams;

function permissioned(handler: RequestHandler, accessMode: AccessMode) {
  return ({ request, match, user, session, isRunningLocally }: RequestHandlerParams) => {
    if (accessMode !== 'public') {
      if (!user) {
        const url = new URL(request.url);
        const redirectTo = encodeURIComponent(`${url.pathname}${url.search}`);
        return new Response('Redirect', { status: 302, headers: { 'Location': `/login?redirectTo=${redirectTo}` } });
      }
    }

    if (!handler) {
      return new Response('Not Implemented', { status: 501 });
    }

    return handler({ request, match, user, session, isRunningLocally });
  };
}

export default function page(
  {
    get,
    post,
    put,
    patch,
    delete: deleteAction,
    options,
    copy,
    move,
    mkcol,
    mkcalendar,
    lock,
    unlock,
    propfind,
    proppatch,
    report,
    accessMode,
  }: Params,
): Page {
  return {
    get: get ? permissioned(get, accessMode) : undefined,
    post: post ? permissioned(post, accessMode) : undefined,
    put: put ? permissioned(put, accessMode) : undefined,
    patch: patch ? permissioned(patch, accessMode) : undefined,
    delete: deleteAction ? permissioned(deleteAction, accessMode) : undefined,
    options: options ? permissioned(options, accessMode) : undefined,
    copy: copy ? permissioned(copy, accessMode) : undefined,
    move: move ? permissioned(move, accessMode) : undefined,
    mkcol: mkcol ? permissioned(mkcol, accessMode) : undefined,
    mkcalendar: mkcalendar ? permissioned(mkcalendar, accessMode) : undefined,
    lock: lock ? permissioned(lock, accessMode) : undefined,
    unlock: unlock ? permissioned(unlock, accessMode) : undefined,
    propfind: propfind ? permissioned(propfind, accessMode) : undefined,
    proppatch: proppatch ? permissioned(proppatch, accessMode) : undefined,
    report: report ? permissioned(report, accessMode) : undefined,
  };
}
