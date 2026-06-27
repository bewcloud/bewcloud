import page, { RequestHandlerParams } from '/lib/page.ts';

import { Directory } from '/lib/types.ts';
import { DirectoryModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  oldParentPath: string;
  newParentPath: string;
  name: string;
}

export interface ResponseBody {
  success: boolean;
  newDirectories: Directory[];
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
    !requestBody.oldParentPath || !requestBody.newParentPath || !requestBody.name?.trim() ||
    !requestBody.oldParentPath.startsWith('/') ||
    requestBody.oldParentPath.includes('../') || !requestBody.newParentPath.startsWith('/') ||
    requestBody.newParentPath.includes('../')
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  const movedDirectory = await DirectoryModel.rename(
    user!.id,
    requestBody.oldParentPath,
    requestBody.newParentPath,
    requestBody.name.trim(),
    requestBody.name.trim(),
  );

  const newDirectories = await DirectoryModel.list(user!.id, requestBody.oldParentPath);

  const responseBody: ResponseBody = { success: movedDirectory, newDirectories };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
