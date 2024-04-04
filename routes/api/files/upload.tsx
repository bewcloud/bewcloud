import { Handlers } from 'fresh/server.ts';

import { DirectoryFile, FreshContextState } from '/lib/types.ts';
import { createFile, getDirectoryAccess, getFileAccess, getFiles } from '/lib/data/files.ts';

interface Data {}

export interface ResponseBody {
  success: boolean;
  newFiles: DirectoryFile[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().formData();

    const parentPath = requestBody.get('parent_path') as string;
    const name = requestBody.get('name') as string;
    const contents = requestBody.get('contents') as File;

    if (
      !parentPath || !name.trim() || !contents || !parentPath.startsWith('/') ||
      parentPath.includes('../')
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    let { hasWriteAccess, ownerUserId, ownerParentPath } = await getFileAccess(
      context.state.user.id,
      parentPath,
      name.trim(),
    );

    if (!hasWriteAccess) {
      const directoryAccessResult = await getDirectoryAccess(context.state.user.id, parentPath);

      hasWriteAccess = directoryAccessResult.hasWriteAccess;
      ownerUserId = directoryAccessResult.ownerUserId;
      ownerParentPath = directoryAccessResult.ownerParentPath;

      if (!hasWriteAccess) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    const createdFile = await createFile(ownerUserId, ownerParentPath, name.trim(), await contents.arrayBuffer());

    const newFiles = await getFiles(context.state.user.id, parentPath);

    const responseBody: ResponseBody = { success: createdFile, newFiles };

    return new Response(JSON.stringify(responseBody));
  },
};
