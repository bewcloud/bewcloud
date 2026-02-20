import page, { RequestHandlerParams } from '/lib/page.ts';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';
import { DirectoryModel, FileModel } from '/lib/models/files.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import { html } from '/public/ts/utils/misc.ts';
import Loading from '/components/Loading.ts';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('notes'))) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/files` } });
  }

  const searchParams = new URL(request.url).searchParams;

  let currentPath = searchParams.get('path') || '/Notes/';

  // Send invalid paths back to Notes root
  if (!currentPath.startsWith('/Notes/') || currentPath.includes('../')) {
    currentPath = '/Notes/';
  }

  // Always append a trailing slash
  if (!currentPath.endsWith('/')) {
    currentPath = `${currentPath}/`;
  }

  const userDirectories = await DirectoryModel.list(user!.id, currentPath);

  const userFiles = await FileModel.list(user!.id, currentPath);

  const userNotes = userFiles.filter((file) => file.file_name.endsWith('.md'));

  const htmlContent = defaultHtmlContent({ userDirectories, userNotes, currentPath });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix: 'Notes',
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent({ userDirectories, userNotes, currentPath }: {
  userDirectories: Directory[];
  userNotes: DirectoryFile[];
  currentPath: string;
}) {
  const htmlContent = html`
    <main id="main">
      <section id="main-notes">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import MainNotes from '/public/components/notes/MainNotes.js';

    const mainNotesElement = document.getElementById('main-notes');

    if (mainNotesElement) {
      const mainNotesApp = h(MainNotes, {
        initialDirectories: ${JSON.stringify(userDirectories || [])},
        initialFiles: ${JSON.stringify(userNotes || [])},
        initialPath: ${JSON.stringify(currentPath)},
      });

      render(mainNotesApp, mainNotesElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;

  return htmlContent;
}

export default page({
  get,
  accessMode: 'user',
});
