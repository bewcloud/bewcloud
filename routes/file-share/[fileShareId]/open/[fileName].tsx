import { Handlers } from 'fresh/server.ts';
import { join } from '@std/path';

import { FreshContextState } from '/lib/types.ts';
import { ensureFileSharePathIsValidAndSecurelyAccessible, FileModel, FileShareModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';

interface Data {}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    const { fileShareId, fileName } = context.params;

    if (!fileShareId || !fileName) {
      return new Response('Not Found', { status: 404 });
    }

    const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

    if (!isPublicFileSharingAllowed) {
      return new Response('Not Found', { status: 404 });
    }

    const fileShare = await FileShareModel.getById(fileShareId);

    if (!fileShare) {
      return new Response('Not Found', { status: 404 });
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
      return new Response('Not Found', { status: 404 });
    }

    return new Response(fileResult.contents! as BodyInit, {
      status: 200,
      headers: {
        'cache-control': 'no-cache, no-store, must-revalidate',
        'content-type': fileResult.contentType!,
        'content-length': fileResult.byteSize!.toString(),
      },
    });
  },
};
