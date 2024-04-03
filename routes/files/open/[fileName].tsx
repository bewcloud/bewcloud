import { Handlers } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { getFile } from '/lib/data/files.ts';

interface Data {}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const { fileName } = context.params;

    if (!fileName) {
      return new Response('Not Found', { status: 404 });
    }

    const searchParams = new URL(request.url).searchParams;

    let currentPath = searchParams.get('path') || '/';

    // Send invalid paths back to root
    if (!currentPath.startsWith('/') || currentPath.includes('../')) {
      currentPath = '/';
    }

    // Always append a trailing slash
    if (!currentPath.endsWith('/')) {
      currentPath = `${currentPath}/`;
    }

    // TODO: Verify user has read or write access to path/file and get the appropriate ownerUserId

    const fileResult = await getFile(context.state.user.id, currentPath, decodeURIComponent(fileName));

    if (!fileResult.success) {
      return new Response('Not Found', { status: 404 });
    }

    return new Response(fileResult.contents!, {
      status: 200,
      headers: { 'cache-control': 'no-cache, no-store, must-revalidate', 'content-type': fileResult.contentType! },
    });
  },
};
