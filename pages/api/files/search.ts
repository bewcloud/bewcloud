import page, { RequestHandlerParams } from '/lib/page.ts';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { searchFilesAndDirectories } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  searchTerm: string;
}

export interface ResponseBody {
  success: boolean;
  directories: Directory[];
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

  if (!requestBody.searchTerm?.trim()) {
    return new Response('Bad Request', { status: 400 });
  }

  const result = await searchFilesAndDirectories(
    user!.id,
    requestBody.searchTerm.trim(),
  );

  const responseBody: ResponseBody = { ...result };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
