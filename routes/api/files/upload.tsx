import { RouteHandler } from 'fresh';

import { Directory, DirectoryFile, FreshContextState } from '/lib/types.ts';
import { DirectoryModel, FileModel } from '/lib/models/files.ts';

interface Data {}

export interface ResponseBody {
  success: boolean;
  newFiles: DirectoryFile[];
  newDirectories: Directory[];
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async POST(context) {
    const request = context.req;

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

    const createdFile = await FileModel.create(context.state.user.id, parentPath, name.trim(), fileContents);

    const newFiles = await FileModel.list(context.state.user.id, pathInView);
    const newDirectories = await DirectoryModel.list(context.state.user.id, pathInView);

    const responseBody: ResponseBody = { success: createdFile, newFiles, newDirectories };

    return new Response(JSON.stringify(responseBody));
  },
};
