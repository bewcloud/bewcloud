import { Handlers, PageProps } from 'fresh/server.ts';
import { join } from '@std/path';

import { Directory, DirectoryFile, FreshContextState } from '/lib/types.ts';
import {
  DirectoryModel,
  ensureFileSharePathIsValidAndSecurelyAccessible,
  FileModel,
  FileShareModel,
} from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';
import FilesWrapper from '/islands/files/FilesWrapper.tsx';

interface Data {
  shareDirectories: Directory[];
  shareFiles: DirectoryFile[];
  currentPath: string;
  baseUrl: string;
  fileShareId?: string;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    const { fileShareId } = context.params;

    if (!fileShareId) {
      return context.renderNotFound();
    }

    const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

    if (!isPublicFileSharingAllowed) {
      return context.renderNotFound();
    }

    const baseUrl = (await AppConfig.getConfig()).auth.baseUrl;

    if (!(await AppConfig.isAppEnabled('files'))) {
      return context.renderNotFound();
    }

    const fileShare = await FileShareModel.getById(fileShareId);

    if (!fileShare) {
      return context.renderNotFound();
    }

    const searchParams = new URL(request.url).searchParams;

    let currentPath = searchParams.get('path') || '/';

    // Send invalid paths back to root
    if (!currentPath.startsWith('/') || currentPath.includes('../')) {
      currentPath = '/';
    }

    // Always append a trailing slash
    if (!currentPath.endsWith('/')) {
      currentPath = `${currentPath}/`;
    }

    // Confirm that currentPath is not _outside_ the fileShare.file_path
    await ensureFileSharePathIsValidAndSecurelyAccessible(fileShare.user_id, fileShare.file_path, currentPath);

    const isFileSharePathDirectory = fileShare.file_path.endsWith('/');

    currentPath = isFileSharePathDirectory ? join(fileShare.file_path, currentPath) : fileShare.file_path;

    const isFilePathDirectory = currentPath.endsWith('/');

    const fileSharePathDirectory = isFileSharePathDirectory
      ? fileShare.file_path
      : `${fileShare.file_path.split('/').slice(0, -1).join('/')}/`;

    const filePathDirectory = isFilePathDirectory ? currentPath : `${currentPath.split('/').slice(0, -1).join('/')}/`;

    // Does the file share require a password? If so, redirect to the verification page
    if (fileShare.extra.hashed_password) {
      const { fileShareId: fileShareIdFromSession, hashedPassword: hashedPasswordFromSession } =
        (await FileShareModel.getDataFromRequest(request)) || {};

      if (
        !fileShareIdFromSession || fileShareIdFromSession !== fileShareId ||
        hashedPasswordFromSession !== fileShare.extra.hashed_password
      ) {
        return new Response('Redirect', { status: 303, headers: { 'Location': `/file-share/${fileShareId}/verify` } });
      }
    }

    let shareDirectories = await DirectoryModel.list(
      fileShare.user_id,
      isFilePathDirectory ? currentPath : filePathDirectory,
    );

    let shareFiles = await FileModel.list(fileShare.user_id, isFilePathDirectory ? currentPath : filePathDirectory);

    if (!isFileSharePathDirectory) {
      shareDirectories = shareDirectories.filter((directory) =>
        directory.directory_name === currentPath.split('/').pop()
      );
      shareFiles = shareFiles.filter((file) => file.file_name === currentPath.split('/').pop());
    }

    // Remove the filePathDirectory from the directories' paths, and set has_write_access to false
    shareDirectories = shareDirectories.map((directory) => ({
      ...directory,
      has_write_access: false,
      parent_path: directory.parent_path.replace(fileSharePathDirectory, '/'),
    }));

    // Remove the filePathDirectory from the files' paths, and set has_write_access to false
    shareFiles = shareFiles.map((file) => ({
      ...file,
      has_write_access: false,
      parent_path: file.parent_path.replace(fileSharePathDirectory, '/'),
    }));

    const publicCurrentPath = currentPath.replace(fileShare.file_path, '/');

    return await context.render({ shareDirectories, shareFiles, currentPath: publicCurrentPath, baseUrl, fileShareId });
  },
};

export default function FilesPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <FilesWrapper
        initialDirectories={data.shareDirectories}
        initialFiles={data.shareFiles}
        initialPath={data.currentPath}
        baseUrl={data.baseUrl}
        isFileSharingAllowed
        areDirectoryDownloadsAllowed={false}
        fileShareId={data.fileShareId}
      />
    </main>
  );
}
