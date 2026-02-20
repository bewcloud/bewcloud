import page, { RequestHandlerParams } from '/lib/page.ts';

import { Directory, DirectoryFile, FileShare } from '/lib/types.ts';
import { DirectoryModel, FileModel, FileShareModel, getPathInfo } from '/lib/models/files.ts';
import { generateHash } from '/public/ts/utils/misc.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import { AppConfig } from '/lib/config.ts';

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

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('files'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

  if (!isPublicFileSharingAllowed) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (
    !requestBody.filePath || !requestBody.pathInView || !requestBody.filePath.trim() ||
    !requestBody.pathInView.trim()
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  // Fix Windows clients sending the directory path with backslashes
  requestBody.filePath = requestBody.filePath.replace(/\\/g, '/');

  if (
    !requestBody.filePath.startsWith('/') ||
    requestBody.filePath.includes('../') || !requestBody.pathInView.startsWith('/') ||
    requestBody.pathInView.includes('../')
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  // Confirm the file path belongs to the user
  const { isDirectory, isFile } = await getPathInfo(
    user!.id,
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
    user_id: user!.id,
    file_path: requestBody.filePath,
    extra,
  };

  const createdFileShare = await FileShareModel.create(fileShare);

  const newFiles = await FileModel.list(user!.id, requestBody.pathInView);
  const newDirectories = await DirectoryModel.list(user!.id, requestBody.pathInView);

  const responseBody: ResponseBody = {
    success: true,
    newFiles,
    newDirectories,
    createdFileShareId: createdFileShare.id,
  };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
