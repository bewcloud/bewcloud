import { Handlers } from 'fresh/server.ts';

import { Directory, DirectoryFile, FreshContextState } from '/lib/types.ts';
import { DirectoryModel, FileModel, FileShareModel } from '/lib/models/files.ts';

interface Data {}

export interface RequestBody {
  pathInView: string;
  fileShareId: string;
}

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

    const requestBody = await request.clone().json() as RequestBody;

    if (
      !requestBody.fileShareId || !requestBody.pathInView || !requestBody.pathInView.trim() ||
      !requestBody.pathInView.startsWith('/') || requestBody.pathInView.includes('../')
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    const fileShare = await FileShareModel.getById(requestBody.fileShareId);

    if (!fileShare || fileShare.user_id !== context.state.user.id) {
      return new Response('Not Found', { status: 404 });
    }

    await FileShareModel.delete(requestBody.fileShareId);

    const newFiles = await FileModel.list(context.state.user.id, requestBody.pathInView);
    const newDirectories = await DirectoryModel.list(context.state.user.id, requestBody.pathInView);

    const responseBody: ResponseBody = { success: true, newFiles, newDirectories };

    return new Response(JSON.stringify(responseBody));
  },
};
