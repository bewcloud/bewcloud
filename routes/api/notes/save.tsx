import { Handlers } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { FileModel } from '/lib/models/files.ts';

interface Data {}

export interface RequestBody {
  fileName: string;
  currentPath: string;
  contents: string;
}

export interface ResponseBody {
  success: boolean;
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (
      !requestBody.currentPath || !requestBody.fileName || !requestBody.currentPath.startsWith('/Notes/') ||
      requestBody.currentPath.includes('../') || !requestBody.currentPath.endsWith('/')
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    if (
      !requestBody.currentPath || !requestBody.currentPath.startsWith('/Notes/') ||
      requestBody.currentPath.includes('../')
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    // Don't allow non-markdown files here
    if (!requestBody.fileName.endsWith('.md')) {
      return new Response('Not Found', { status: 404 });
    }

    const fileResult = await FileModel.get(
      context.state.user.id,
      requestBody.currentPath,
      decodeURIComponent(requestBody.fileName),
    );

    if (!fileResult.success) {
      return new Response('Not Found', { status: 404 });
    }

    const updatedFile = await FileModel.update(
      context.state.user.id,
      requestBody.currentPath,
      decodeURIComponent(requestBody.fileName),
      requestBody.contents || '',
    );

    const responseBody: ResponseBody = { success: updatedFile };

    return new Response(JSON.stringify(responseBody));
  },
};
