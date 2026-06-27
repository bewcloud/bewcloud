import page, { RequestHandlerParams } from '/lib/page.ts';
import { join } from '@std/path';

import { Directory, DirectoryFile } from '/lib/types.ts';
import {
  DirectoryModel,
  ensureFileSharePathIsValidAndSecurelyAccessible,
  FileModel,
  FileShareModel,
} from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';
import { html } from '/public/ts/utils/misc.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import Loading from '/components/Loading.ts';

interface Data {
  shareDirectories: Directory[];
  shareFiles: DirectoryFile[];
  currentPath: string;
  baseUrl: string;
  fileShareId?: string;
}

async function get({ request, match, session, isRunningLocally }: RequestHandlerParams) {
  const { fileShareId } = match.pathname.groups;

  if (!fileShareId) {
    throw new Error('NotFound');
  }

  const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

  if (!isPublicFileSharingAllowed) {
    throw new Error('NotFound');
  }

  const baseUrl = (await AppConfig.getConfig()).auth.baseUrl;

  if (!(await AppConfig.isAppEnabled('files'))) {
    throw new Error('NotFound');
  }

  const fileShare = await FileShareModel.getById(fileShareId);

  if (!fileShare) {
    throw new Error('NotFound');
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

  const htmlContent = defaultHtmlContent({
    shareDirectories,
    shareFiles,
    currentPath: publicCurrentPath,
    baseUrl,
    fileShareId,
  });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix: 'File Share',
    match,
    request,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent({ shareDirectories, shareFiles, currentPath, baseUrl, fileShareId }: {
  shareDirectories: Directory[];
  shareFiles: DirectoryFile[];
  currentPath: string;
  baseUrl: string;
  fileShareId: string;
}) {
  return html`
    <main id="main">
      <section id="main-files">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import MainFiles from '/public/components/files/MainFiles.js';

    const mainFilesElement = document.getElementById('main-files');

    if (mainFilesElement) {
      const mainFilesApp = h(MainFiles, {
        initialDirectories: ${JSON.stringify(shareDirectories)},
        initialFiles: ${JSON.stringify(shareFiles)},
        initialPath: ${JSON.stringify(currentPath)},
        baseUrl: ${JSON.stringify(baseUrl)},
        isFileSharingAllowed: true,
        areDirectoryDownloadsAllowed: false,
        fileShareId: ${JSON.stringify(fileShareId)},
      });

      render(mainFilesApp, mainFilesElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}

export default page({
  get,
  accessMode: 'public',
});
