import { Handlers } from 'fresh/server.ts';

import { Directory, DirectoryFile, FileShare, FreshContextState } from '/lib/types.ts';
import { DirectoryModel, FileModel, FileShareModel, getPathInfo } from '/lib/models/files.ts';
import { generateHash } from '/lib/utils/misc.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import { AppConfig } from '/lib/config.ts';

interface Data {}

export interface RequestBody {
  pathInView: string;
  filePath: string;
  password?: string;
}

export interface ResponseBody {
  success: boolean;
  newFiles: DirectoryFile[];
  newDirectories: Directory[];
  createdFileShareId: string;
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

    if (!isPublicFileSharingAllowed) {
      return new Response('Forbidden', { status: 403 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (
      !requestBody.filePath || !requestBody.pathInView || !requestBody.filePath.trim() ||
      !requestBody.pathInView.trim() || !requestBody.filePath.startsWith('/') ||
      requestBody.filePath.includes('../') || !requestBody.pathInView.startsWith('/') ||
      requestBody.pathInView.includes('../')
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    // Confirm the file path belongs to the user
    const { isDirectory, isFile } = await getPathInfo(
      context.state.user.id,
      requestBody.filePath,
    );

    // Confirm the file path ends with a / if it's a directory, and doesn't end with a / if it's a file
    if (isDirectory && !requestBody.filePath.endsWith('/')) {
      requestBody.filePath = `${requestBody.filePath}/`;
    } else if (isFile && requestBody.filePath.endsWith('/')) {
      requestBody.filePath = requestBody.filePath.slice(0, -1);
    }

    const extra: FileShare['extra'] = {};

    if (requestBody.password) {
      extra.hashed_password = await generateHash(`${requestBody.password}:${PASSWORD_SALT}`, 'SHA-256');
    }

    const fileShare: Omit<FileShare, 'id' | 'created_at'> = {
      user_id: context.state.user.id,
      file_path: requestBody.filePath,
      extra,
    };

    const createdFileShare = await FileShareModel.create(fileShare);

    const newFiles = await FileModel.list(context.state.user.id, requestBody.pathInView);
    const newDirectories = await DirectoryModel.list(context.state.user.id, requestBody.pathInView);

    const responseBody: ResponseBody = {
      success: true,
      newFiles,
      newDirectories,
      createdFileShareId: createdFileShare.id,
    };

    return new Response(JSON.stringify(responseBody));
  },
};
