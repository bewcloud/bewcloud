import { Handlers } from 'fresh/server.ts';

import { Directory, FreshContextState } from '/lib/types.ts';
import { getDirectories, getDirectoryAccess, renameDirectoryOrFile } from '/lib/data/files.ts';

interface Data {}

export interface RequestBody {
  parentPath: string;
  oldName: string;
  newName: string;
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
      !requestBody.parentPath || !requestBody.oldName?.trim() || !requestBody.newName?.trim() ||
      !requestBody.parentPath.startsWith('/') ||
      requestBody.parentPath.includes('../')
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    const { hasWriteAccess, ownerUserId, ownerParentPath } = await getDirectoryAccess(
      context.state.user.id,
      requestBody.parentPath,
      requestBody.oldName.trim(),
    );

    if (!hasWriteAccess) {
      return new Response('Forbidden', { status: 403 });
    }

    const movedDirectory = await renameDirectoryOrFile(
      ownerUserId,
      ownerParentPath,
      ownerParentPath,
      requestBody.oldName.trim(),
      requestBody.newName.trim(),
    );

    const newDirectories = await getDirectories(context.state.user.id, requestBody.parentPath);

    const responseBody: ResponseBody = { success: movedDirectory, newDirectories };

    return new Response(JSON.stringify(responseBody));
  },
};
