import { Handlers } from 'fresh/server.ts';

import { DirectoryFile, FreshContextState } from '/lib/types.ts';
import { deleteDirectoryOrFile, getFiles } from '/lib/data/files.ts';

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

    const deletedFile = await deleteDirectoryOrFile(
      context.state.user.id,
      requestBody.parentPath,
      requestBody.name.trim(),
    );

    const newFiles = await getFiles(context.state.user.id, requestBody.parentPath);

    const responseBody: ResponseBody = { success: deletedFile, newFiles };

    return new Response(JSON.stringify(responseBody));
  },
};
