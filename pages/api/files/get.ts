import page, { RequestHandlerParams } from '/lib/page.ts';

import { DirectoryFile } from '/lib/types.ts';
import { FileModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  parentPath: string;
}

export interface ResponseBody {
  success: boolean;
  files: DirectoryFile[];
}

async function post({ request, user }: RequestHandlerParams) {
  if (
    !(await AppConfig.isAppEnabled('files')) && !(await AppConfig.isAppEnabled('photos')) &&
    !(await AppConfig.isAppEnabled('notes'))
  ) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (
    !requestBody.parentPath || !requestBody.parentPath.startsWith('/') || requestBody.parentPath.includes('../')
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  const files = await FileModel.list(
    user!.id,
    requestBody.parentPath,
  );

  const responseBody: ResponseBody = { success: true, files };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
