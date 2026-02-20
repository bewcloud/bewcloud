import page, { RequestHandlerParams } from '/lib/page.ts';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { DirectoryModel, FileModel, FileShareModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  pathInView: string;
  fileShareId: string;
}

export interface ResponseBody {
  success: boolean;
  newFiles: DirectoryFile[];
  newDirectories: Directory[];
}

async function post({ request, user }: RequestHandlerParams) {
  const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

  if (!isPublicFileSharingAllowed) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!(await AppConfig.isAppEnabled('files'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (
    !requestBody.fileShareId || !requestBody.pathInView || !requestBody.pathInView.trim() ||
    !requestBody.pathInView.startsWith('/') || requestBody.pathInView.includes('../')
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  const fileShare = await FileShareModel.getById(requestBody.fileShareId);

  if (!fileShare || fileShare.user_id !== user!.id) {
    return new Response('Not Found', { status: 404 });
  }

  await FileShareModel.delete(requestBody.fileShareId);

  const newFiles = await FileModel.list(user!.id, requestBody.pathInView);
  const newDirectories = await DirectoryModel.list(user!.id, requestBody.pathInView);

  const responseBody: ResponseBody = { success: true, newFiles, newDirectories };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
