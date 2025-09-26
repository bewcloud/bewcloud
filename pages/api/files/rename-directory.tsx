import { Directory, FreshContextState } from '/lib/types.ts';
import { DirectoryModel } from '/lib/models/files.ts';

interface Data {}

export interface RequestBody {
  parentPath: string;
  oldName: string;
  newName: string;
}

export interface ResponseBody {
  success: boolean;
  newDirectories: Directory[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (
      !requestBody.parentPath || !requestBody.oldName?.trim() || !requestBody.newName?.trim() ||
      !requestBody.parentPath.startsWith('/') ||
      requestBody.parentPath.includes('../')
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    const movedDirectory = await DirectoryModel.rename(
      context.state.user.id,
      requestBody.parentPath,
      requestBody.parentPath,
      requestBody.oldName.trim(),
      requestBody.newName.trim(),
    );

    const newDirectories = await DirectoryModel.list(context.state.user.id, requestBody.parentPath);

    const responseBody: ResponseBody = { success: movedDirectory, newDirectories };

    return new Response(JSON.stringify(responseBody));
  },
};
