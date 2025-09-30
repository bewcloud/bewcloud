import { Handlers } from 'fresh/server.ts';

import { DirectoryFile, FreshContextState } from '/lib/types.ts';
import { FileModel } from '/lib/models/files.ts';
import { SortColumn, SortOrder } from '/lib/utils/files.ts';

interface Data {}

export interface RequestBody {
  parentPath: string;
  sortBy?: SortColumn;
  sortOrder?: SortOrder;
}

export interface ResponseBody {
  success: boolean;
  files: DirectoryFile[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (
      !requestBody.parentPath || !requestBody.parentPath.startsWith('/') || requestBody.parentPath.includes('../')
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    const sortOptions = (requestBody.sortBy && requestBody.sortOrder) 
      ? { sortBy: requestBody.sortBy, sortOrder: requestBody.sortOrder }
      : undefined;

    const files = await FileModel.list(
      context.state.user.id,
      requestBody.parentPath,
      sortOptions,
    );

    const responseBody: ResponseBody = { success: true, files };

    return new Response(JSON.stringify(responseBody));
  },
};
