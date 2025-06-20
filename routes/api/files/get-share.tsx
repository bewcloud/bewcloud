import { Handlers } from 'fresh/server.ts';

import { FileShare, FreshContextState } from '/lib/types.ts';
import { FileShareModel } from '/lib/models/files.ts';

interface Data {}

export interface RequestBody {
  fileShareId: string;
}

export interface ResponseBody {
  success: boolean;
  fileShare: FileShare;
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (!requestBody.fileShareId) {
      return new Response('Bad Request', { status: 400 });
    }

    const fileShare = await FileShareModel.getById(requestBody.fileShareId);

    if (!fileShare || fileShare.user_id !== context.state.user.id) {
      return new Response('Not Found', { status: 404 });
    }

    const responseBody: ResponseBody = { success: true, fileShare };

    return new Response(JSON.stringify(responseBody));
  },
};
