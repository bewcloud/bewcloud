import { Handlers } from 'fresh/server.ts';

import { DirectoryFile, FreshContextState } from '/lib/types.ts';
import { getFiles, renameDirectoryOrFile } from '/lib/data/files.ts';

interface Data {}

export interface RequestBody {
  parentPath: string;
  oldName: string;
  newName: string;
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
      !requestBody.parentPath || !requestBody.oldName?.trim() || !requestBody.newName?.trim() ||
      !requestBody.parentPath.startsWith('/') ||
      requestBody.parentPath.includes('../')
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    // TODO: Verify user has write access to path/file and get the appropriate ownerUserId

    const movedFile = await renameDirectoryOrFile(
      context.state.user.id,
      requestBody.parentPath,
      requestBody.parentPath,
      requestBody.oldName.trim(),
      requestBody.newName.trim(),
    );

    const newFiles = await getFiles(context.state.user.id, requestBody.parentPath);

    const responseBody: ResponseBody = { success: movedFile, newFiles };

    return new Response(JSON.stringify(responseBody));
  },
};
