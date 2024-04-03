import { Handlers } from 'fresh/server.ts';

import { Directory, FreshContextState } from '/lib/types.ts';
import { getDirectories } from '/lib/data/files.ts';

interface Data {}

export interface RequestBody {
  parentPath: string;
  directoryPathToExclude?: string;
}

export interface ResponseBody {
  success: boolean;
  directories: Directory[];
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

    const directories = await getDirectories(
      context.state.user.id,
      requestBody.parentPath,
    );

    const filteredDirectories = requestBody.directoryPathToExclude
      ? directories.filter((directory) =>
        `${directory.parent_path}${directory.directory_name}` !== requestBody.directoryPathToExclude
      )
      : directories;

    const responseBody: ResponseBody = { success: true, directories: filteredDirectories };

    return new Response(JSON.stringify(responseBody));
  },
};
