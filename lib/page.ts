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
  patch?: RequestHandler;
  delete?: RequestHandler;
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
  { get, post, patch, delete: deleteAction, accessMode }: Params,
): Page {
  return {
    get: get ? permissioned(get, accessMode) : undefined,
    post: post ? permissioned(post, accessMode) : undefined,
    patch: patch ? permissioned(patch, accessMode) : undefined,
    delete: deleteAction ? permissioned(deleteAction, accessMode) : undefined,
  };
}
