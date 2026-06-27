import page, { RequestHandlerParams } from '/lib/page.ts';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';
import { DirectoryModel, FileModel } from '/lib/models/files.ts';
import { PHOTO_EXTENSIONS } from '/public/ts/utils/photos.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import { html } from '/public/ts/utils/misc.ts';
import Loading from '/components/Loading.ts';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('photos'))) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/files` } });
  }

  const searchParams = new URL(request.url).searchParams;

  let currentPath = searchParams.get('path') || '/Photos/';

  // Send invalid paths back to Photos root
  if (!currentPath.startsWith('/Photos/') || currentPath.includes('../')) {
    currentPath = '/Photos/';
  }

  // Always append a trailing slash
  if (!currentPath.endsWith('/')) {
    currentPath = `${currentPath}/`;
  }

  const userDirectories = await DirectoryModel.list(user!.id, currentPath);

  const userFiles = await FileModel.list(user!.id, currentPath);

  const userPhotos = userFiles.filter((file) => {
    const lowercaseFileName = file.file_name.toLowerCase();

    return PHOTO_EXTENSIONS.some((extension) => lowercaseFileName.endsWith(extension));
  });

  const htmlContent = defaultHtmlContent({ userDirectories, userPhotos, currentPath });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix: 'Photos',
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent({ userDirectories, userPhotos, currentPath }: {
  userDirectories: Directory[];
  userPhotos: DirectoryFile[];
  currentPath: string;
}) {
  return html`
    <main id="main">
      <section id="main-photos">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import MainPhotos from '/public/components/photos/MainPhotos.js';

    const mainPhotosElement = document.getElementById('main-photos');

    if (mainPhotosElement) {
      const mainPhotosApp = h(MainPhotos, {
        initialDirectories: ${JSON.stringify(userDirectories || [])},
        initialFiles: ${JSON.stringify(userPhotos || [])},
        initialPath: ${JSON.stringify(currentPath)},
      });

      render(mainPhotosApp, mainPhotosElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}

export default page({
  get,
  accessMode: 'user',
});
