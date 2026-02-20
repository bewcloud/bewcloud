import page, { RequestHandlerParams } from '/lib/page.ts';

import { Directory } from '/lib/types.ts';
import { DirectoryModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  parentPath: string;
  directoryPathToExclude?: string;
}

export interface ResponseBody {
  success: boolean;
  directories: Directory[];
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

  const directories = await DirectoryModel.list(
    user!.id,
    requestBody.parentPath,
  );

  const filteredDirectories = requestBody.directoryPathToExclude
    ? directories.filter((directory) =>
      `${directory.parent_path}${directory.directory_name}` !== requestBody.directoryPathToExclude
    )
    : directories;

  const responseBody: ResponseBody = { success: true, directories: filteredDirectories };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
