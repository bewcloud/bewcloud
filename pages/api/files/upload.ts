import page, { RequestHandlerParams } from '/lib/page.ts';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { DirectoryModel, FileModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';

export interface ResponseBody {
  success: boolean;
  newFiles: DirectoryFile[];
  newDirectories: Directory[];
}

async function post({ request, user }: RequestHandlerParams) {
  if (
    !(await AppConfig.isAppEnabled('files')) && !(await AppConfig.isAppEnabled('photos')) &&
    !(await AppConfig.isAppEnabled('notes'))
  ) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().formData();

  const pathInView = requestBody.get('path_in_view') as string;
  const parentPath = requestBody.get('parent_path') as string;
  const name = requestBody.get('name') as string;
  const contents = requestBody.get('contents') as File | string;

  if (
    !parentPath || !pathInView || !name.trim() || !contents || !parentPath.startsWith('/') ||
    parentPath.includes('../') || !pathInView.startsWith('/') || pathInView.includes('../')
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  const fileContents = typeof contents === 'string' ? contents : await contents.arrayBuffer();

  const createdFile = await FileModel.create(user!.id, parentPath, name.trim(), fileContents);

  const newFiles = await FileModel.list(user!.id, pathInView);
  const newDirectories = await DirectoryModel.list(user!.id, pathInView);

  const responseBody: ResponseBody = { success: createdFile, newFiles, newDirectories };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
