import page, { RequestHandlerParams } from '/lib/page.ts';

import { AppConfig } from '/lib/config.ts';
import { FileModel } from '/lib/models/files.ts';

async function get({ request, user, match }: RequestHandlerParams): Promise<Response> {
  const { fileName } = match.pathname.groups;

  if (!fileName) {
    throw new Error('NotFound');
  }

  if (!(await AppConfig.isAppEnabled('files'))) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
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

  const fileResult = await FileModel.get(user!.id, currentPath, decodeURIComponent(fileName));

  if (!fileResult.success) {
    throw new Error('NotFound');
  }

  return new Response(fileResult.contents! as BodyInit, {
    status: 200,
    headers: {
      'cache-control': 'no-cache, no-store, must-revalidate',
      'content-type': fileResult.contentType!,
      'content-length': fileResult.byteSize!.toString(),
    },
  });
}

export default page({
  get,
  accessMode: 'user',
});
