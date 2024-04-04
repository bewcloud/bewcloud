import { Handlers } from 'fresh/server.ts';

import { DirectoryFile, FreshContextState } from '/lib/types.ts';
import { getDirectoryAccess, getFileAccess, getFiles, renameDirectoryOrFile } from '/lib/data/files.ts';

interface Data {}

export interface RequestBody {
  oldParentPath: string;
  newParentPath: string;
  name: string;
}

export interface ResponseBody {
  success: boolean;
  newFiles: DirectoryFile[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
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

    let { hasWriteAccess: hasOldWriteAccess, ownerUserId, ownerParentPath: oldOwnerParentPath } = await getFileAccess(
      context.state.user.id,
      requestBody.oldParentPath,
      requestBody.name.trim(),
    );

    if (!hasOldWriteAccess) {
      const directoryAccessResult = await getDirectoryAccess(context.state.user.id, requestBody.oldParentPath);

      hasOldWriteAccess = directoryAccessResult.hasWriteAccess;
      ownerUserId = directoryAccessResult.ownerUserId;
      oldOwnerParentPath = directoryAccessResult.ownerParentPath;

      return new Response('Forbidden', { status: 403 });
    }

    const { hasWriteAccess: hasNewWriteAccess, ownerParentPath: newOwnerParentPath } = await getDirectoryAccess(
      context.state.user.id,
      requestBody.newParentPath,
    );

    if (!hasNewWriteAccess) {
      return new Response('Forbidden', { status: 403 });
    }

    const movedFile = await renameDirectoryOrFile(
      ownerUserId,
      oldOwnerParentPath,
      newOwnerParentPath,
      requestBody.name.trim(),
      requestBody.name.trim(),
    );

    const newFiles = await getFiles(context.state.user.id, requestBody.oldParentPath);

    const responseBody: ResponseBody = { success: movedFile, newFiles };

    return new Response(JSON.stringify(responseBody));
  },
};
