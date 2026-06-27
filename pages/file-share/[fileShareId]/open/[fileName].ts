import page, { RequestHandlerParams } from '/lib/page.ts';
import { join } from '@std/path';

import { ensureFileSharePathIsValidAndSecurelyAccessible, FileModel, FileShareModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';

async function get({ request, match }: RequestHandlerParams): Promise<Response> {
  const { fileShareId, fileName } = match.pathname.groups;

  if (!fileShareId || !fileName) {
    throw new Error('NotFound');
  }

  const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

  if (!isPublicFileSharingAllowed) {
    throw new Error('NotFound');
  }

  if (!(await AppConfig.isAppEnabled('files'))) {
    throw new Error('NotFound');
  }

  const fileShare = await FileShareModel.getById(fileShareId);

  if (!fileShare) {
    throw new Error('NotFound');
  }

  if (fileShare.extra.hashed_password) {
    const { fileShareId: fileShareIdFromSession, hashedPassword: hashedPasswordFromSession } =
      (await FileShareModel.getDataFromRequest(request)) || {};

    if (
      !fileShareIdFromSession || fileShareIdFromSession !== fileShareId ||
      hashedPasswordFromSession !== fileShare.extra.hashed_password
    ) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/file-share/${fileShareId}/verify` } });
    }
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

  // Confirm that currentPath is not _outside_ the fileShare.file_path
  await ensureFileSharePathIsValidAndSecurelyAccessible(fileShare.user_id, fileShare.file_path, currentPath);

  const isFileSharePathDirectory = fileShare.file_path.endsWith('/');

  const fileSharePathDirectory = isFileSharePathDirectory
    ? fileShare.file_path
    : `${fileShare.file_path.split('/').slice(0, -1).join('/')}/`;

  currentPath = isFileSharePathDirectory ? join(fileShare.file_path, currentPath) : fileSharePathDirectory;

  const fileResult = await FileModel.get(fileShare.user_id, currentPath, decodeURIComponent(fileName));

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
  accessMode: 'public',
});
