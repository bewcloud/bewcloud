import page, { RequestHandlerParams } from '/lib/page.ts';

import { Directory } from '/lib/types.ts';
import { DirectoryModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  parentPath: string;
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
    !requestBody.parentPath || !requestBody.name?.trim() || !requestBody.parentPath.startsWith('/') ||
    requestBody.parentPath.includes('../')
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  const deletedDirectory = await DirectoryModel.delete(
    user!.id,
    requestBody.parentPath,
    requestBody.name.trim(),
  );

  const newDirectories = await DirectoryModel.list(user!.id, requestBody.parentPath);

  const responseBody: ResponseBody = { success: deletedDirectory, newDirectories };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
