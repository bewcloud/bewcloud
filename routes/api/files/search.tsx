import { RouteHandler } from 'fresh';

import { Directory, DirectoryFile, FreshContextState } from '/lib/types.ts';
import { searchFilesAndDirectories } from '/lib/models/files.ts';

interface Data {}

export interface RequestBody {
  searchTerm: string;
}

export interface ResponseBody {
  success: boolean;
  directories: Directory[];
  files: DirectoryFile[];
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async POST(context) {
    const request = context.req;

    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (!requestBody.searchTerm?.trim()) {
      return new Response('Bad Request', { status: 400 });
    }

    const result = await searchFilesAndDirectories(
      context.state.user.id,
      requestBody.searchTerm.trim(),
    );

    const responseBody: ResponseBody = { ...result };

    return new Response(JSON.stringify(responseBody));
  },
};
