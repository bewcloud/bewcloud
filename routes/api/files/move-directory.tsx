import { Handlers } from 'fresh/server.ts';

import { Directory, FreshContextState } from '/lib/types.ts';
import { getDirectories, renameDirectoryOrFile } from '/lib/data/files.ts';

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

    // TODO: Verify user has write access to old and new paths and get the appropriate ownerUserIds

    const movedDirectory = await renameDirectoryOrFile(
      context.state.user.id,
      requestBody.oldParentPath,
      requestBody.newParentPath,
      requestBody.name.trim(),
      requestBody.name.trim(),
    );

    const newDirectories = await getDirectories(context.state.user.id, requestBody.oldParentPath);

    const responseBody: ResponseBody = { success: movedDirectory, newDirectories };

    return new Response(JSON.stringify(responseBody));
  },
};
