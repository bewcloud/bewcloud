import page, { RequestHandlerParams } from '/lib/page.ts';

import { DirectoryFile } from '/lib/types.ts';
import { FileModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  parentPath: string;
  name: string;
}

export interface ResponseBody {
  success: boolean;
  newFiles: DirectoryFile[];
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
    !requestBody.parentPath || !requestBody.name?.trim() || !requestBody.parentPath.startsWith('/') ||
    requestBody.parentPath.includes('../')
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  const deletedFile = await FileModel.delete(
    user!.id,
    requestBody.parentPath,
    requestBody.name.trim(),
  );

  const newFiles = await FileModel.list(user!.id, requestBody.parentPath);

  const responseBody: ResponseBody = { success: deletedFile, newFiles };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
