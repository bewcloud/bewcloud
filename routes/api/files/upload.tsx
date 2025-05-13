import { Handlers } from 'fresh/server.ts';

import { Directory, DirectoryFile, FreshContextState } from '/lib/types.ts';
import { createFile, getDirectories, getFiles } from '/lib/data/files.ts';

interface Data {}

export interface ResponseBody {
  success: boolean;
  newFiles: DirectoryFile[];
  newDirectories: Directory[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().formData();

    const pathInView = requestBody.get('path_in_view') as string;
    const parentPath = requestBody.get('parent_path') as string;
    const name = requestBody.get('name') as string;
    const contents = requestBody.get('contents') as File | string;

    if (
      !parentPath || !pathInView || !name.trim() || !contents || !parentPath.startsWith('/') ||
      parentPath.includes('../') || !pathInView.startsWith('/') || pathInView.includes('../')
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    const fileContents = typeof contents === 'string' ? contents : await contents.arrayBuffer();

    const createdFile = await createFile(context.state.user.id, parentPath, name.trim(), fileContents);

    const newFiles = await getFiles(context.state.user.id, pathInView);
    const newDirectories = await getDirectories(context.state.user.id, pathInView);

    const responseBody: ResponseBody = { success: createdFile, newFiles, newDirectories };

    return new Response(JSON.stringify(responseBody));
  },
};
