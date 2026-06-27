import page, { RequestHandlerParams } from '/lib/page.ts';

import { Dashboard } from '/lib/types.ts';
import { DashboardModel } from '/lib/models/dashboard.ts';
import { AppConfig } from '/lib/config.ts';
import { html } from '/public/ts/utils/misc.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import Loading from '/components/Loading.ts';

const titlePrefix = 'Dashboard';

async function get({ request, match, user, session, isRunningLocally }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('dashboard'))) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
  }

  let userDashboard = await DashboardModel.getByUserId(user!.id);

  if (!userDashboard) {
    userDashboard = await DashboardModel.create(user!.id);
  }

  const htmlContent = defaultHtmlContent({ userDashboard });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix,
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent({ userDashboard }: { userDashboard: Dashboard }) {
  const initialNotes = userDashboard?.data?.notes || 'Jot down some notes here.';

  return html`
    <main id="main">
      ${Loading()}
      <section id="links"></section>
      <section id="notes"></section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import Links from '/public/components/dashboard/Links.js';
    import Notes from '/public/components/dashboard/Notes.js';

    const linksElement = document.getElementById('links');
    const notesElement = document.getElementById('notes');

    if (linksElement) {
      const linksApp = h(Links, { initialLinks: ${JSON.stringify(userDashboard?.data?.links || [])} });

      render(linksApp, linksElement);
    }

    if (notesElement) {
      const notesApp = h(Notes, { initialNotes: ${JSON.stringify(initialNotes)} });

      render(notesApp, notesElement);
    }

    if (linksElement && notesElement) {
      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}

export default page({
  get,
  accessMode: 'user',
});
