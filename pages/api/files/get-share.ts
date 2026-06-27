import page, { RequestHandlerParams } from '/lib/page.ts';

import { FileShare } from '/lib/types.ts';
import { FileShareModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  fileShareId: string;
}

export interface ResponseBody {
  success: boolean;
  fileShare: FileShare;
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

  if (!requestBody.fileShareId) {
    return new Response('Bad Request', { status: 400 });
  }

  const fileShare = await FileShareModel.getById(requestBody.fileShareId);

  if (!fileShare || fileShare.user_id !== user!.id) {
    return new Response('Not Found', { status: 404 });
  }

  const responseBody: ResponseBody = { success: true, fileShare };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
