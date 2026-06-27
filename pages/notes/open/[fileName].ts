import page, { RequestHandlerParams } from '/lib/page.ts';

import { FileModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import { html } from '/public/ts/utils/misc.ts';
import Loading from '/components/Loading.ts';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams): Promise<Response> {
  const { fileName } = match.pathname.groups;

  if (!fileName) {
    throw new Error('NotFound');
  }

  if (!(await AppConfig.isAppEnabled('notes'))) {
    throw new Error('Notes app is not enabled');
  }

  const searchParams = new URL(request.url).searchParams;

  let currentPath = searchParams.get('path') || '/';

  // Send invalid paths back to notes root
  if (!currentPath.startsWith('/Notes/') || currentPath.includes('../')) {
    currentPath = '/Notes/';
  }

  // Always append a trailing slash
  if (!currentPath.endsWith('/')) {
    currentPath = `${currentPath}/`;
  }

  // Don't allow non-markdown files here
  if (!fileName.endsWith('.md')) {
    throw new Error('NotFound');
  }

  const fileResult = await FileModel.get(user!.id, currentPath, decodeURIComponent(fileName));

  if (!fileResult.success) {
    throw new Error('NotFound');
  }

  const htmlContent = defaultHtmlContent({
    fileName,
    currentPath,
    contents: new TextDecoder().decode(fileResult.contents!),
  });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix: `${fileName} - Notes`,
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent(
  { fileName, currentPath, contents }: { fileName: string; currentPath: string; contents: string },
) {
  return html`
    <main id="main">
      <section id="note">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import Note from '/public/components/notes/Note.js';

    const noteElement = document.getElementById('note');

    if (noteElement) {
      const noteApp = h(Note, {
        fileName: ${JSON.stringify(fileName)},
        currentPath: ${JSON.stringify(currentPath)},
        contents: ${JSON.stringify(contents)},
      });

      render(noteApp, noteElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}

export default page({
  get,
  accessMode: 'user',
});
