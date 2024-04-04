import { Handlers } from 'fresh/server.ts';

import { Directory, FreshContextState } from '/lib/types.ts';
import { getDirectories, getDirectoryAccess, renameDirectoryOrFile } from '/lib/data/files.ts';

interface Data {}

export interface RequestBody {
  oldParentPath: string;
  newParentPath: string;
  name: string;
}

export interface ResponseBody {
  success: boolean;
  newDirectories: Directory[];
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

    const { hasWriteAccess: hasOldWriteAccess, ownerUserId, ownerParentPath: oldOwnerParentPath } =
      await getDirectoryAccess(context.state.user.id, requestBody.oldParentPath, requestBody.name.trim());

    if (!hasOldWriteAccess) {
      return new Response('Forbidden', { status: 403 });
    }

    const { hasWriteAccess: hasNewWriteAccess, ownerParentPath: newOwnerParentPath } = await getDirectoryAccess(
      context.state.user.id,
      requestBody.newParentPath,
    );

    if (!hasNewWriteAccess) {
      return new Response('Forbidden', { status: 403 });
    }

    const movedDirectory = await renameDirectoryOrFile(
      ownerUserId,
      oldOwnerParentPath,
      newOwnerParentPath,
      requestBody.name.trim(),
      requestBody.name.trim(),
    );

    const newDirectories = await getDirectories(context.state.user.id, requestBody.oldParentPath);

    const responseBody: ResponseBody = { success: movedDirectory, newDirectories };

    return new Response(JSON.stringify(responseBody));
  },
};
