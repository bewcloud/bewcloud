import { Handlers } from 'fresh/server.ts';

import { DirectoryFile, FreshContextState } from '/lib/types.ts';
import { deleteDirectoryOrFile, getDirectoryAccess, getFileAccess, getFiles } from '/lib/data/files.ts';

interface Data {}

export interface RequestBody {
  parentPath: string;
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
      !requestBody.parentPath || !requestBody.name?.trim() || !requestBody.parentPath.startsWith('/') ||
      requestBody.parentPath.includes('../')
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    let { hasWriteAccess, ownerUserId, ownerParentPath } = await getFileAccess(
      context.state.user.id,
      requestBody.parentPath,
      requestBody.name.trim(),
    );

    if (!hasWriteAccess) {
      const directoryAccessResult = await getDirectoryAccess(context.state.user.id, requestBody.parentPath);

      hasWriteAccess = directoryAccessResult.hasWriteAccess;
      ownerUserId = directoryAccessResult.ownerUserId;
      ownerParentPath = directoryAccessResult.ownerParentPath;

      if (!hasWriteAccess) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    const deletedFile = await deleteDirectoryOrFile(
      ownerUserId,
      ownerParentPath,
      requestBody.name.trim(),
    );

    const newFiles = await getFiles(context.state.user.id, requestBody.parentPath);

    const responseBody: ResponseBody = { success: deletedFile, newFiles };

    return new Response(JSON.stringify(responseBody));
  },
};
