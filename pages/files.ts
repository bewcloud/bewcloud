import page, { RequestHandlerParams } from '/lib/page.ts';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { DirectoryModel, FileModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';
import { html } from '/public/ts/utils/misc.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import Loading from '/components/Loading.ts';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  const baseUrl = (await AppConfig.getConfig()).auth.baseUrl;

  if (!(await AppConfig.isAppEnabled('files'))) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
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

  const userDirectories = await DirectoryModel.list(user!.id, currentPath);

  const userFiles = await FileModel.list(user!.id, currentPath);

  const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();
  const areDirectoryDownloadsAllowed = await AppConfig.areDirectoryDownloadsAllowed();

  const htmlContent = defaultHtmlContent({
    userDirectories,
    userFiles,
    currentPath,
    baseUrl,
    isFileSharingAllowed: isPublicFileSharingAllowed,
    areDirectoryDownloadsAllowed,
  });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix: 'Files',
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent(
  { userDirectories, userFiles, currentPath, baseUrl, isFileSharingAllowed, areDirectoryDownloadsAllowed }: {
    userDirectories: Directory[];
    userFiles: DirectoryFile[];
    currentPath: string;
    baseUrl: string;
    isFileSharingAllowed: boolean;
    areDirectoryDownloadsAllowed: boolean;
  },
) {
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
        initialDirectories: ${JSON.stringify(userDirectories)},
        initialFiles: ${JSON.stringify(userFiles)},
        initialPath: ${JSON.stringify(currentPath)},
        baseUrl: ${JSON.stringify(baseUrl)},
        isFileSharingAllowed: ${JSON.stringify(isFileSharingAllowed)},
        areDirectoryDownloadsAllowed: ${JSON.stringify(areDirectoryDownloadsAllowed)},
      });

      render(mainFilesApp, mainFilesElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}

export default page({
  get,
  accessMode: 'user',
});
