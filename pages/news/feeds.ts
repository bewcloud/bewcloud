import page, { RequestHandlerParams } from '/lib/page.ts';

import { FeedModel } from '/lib/models/news.ts';
import { AppConfig } from '/lib/config.ts';
import { NewsFeed } from '/lib/types.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import { html } from '/public/ts/utils/misc.ts';
import Loading from '/components/Loading.ts';

const titlePrefix = 'News Feeds';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams): Promise<Response> {
  if (!(await AppConfig.isAppEnabled('news'))) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
  }

  const userFeeds = await FeedModel.list(user!.id);

  const htmlContent = defaultHtmlContent({ userFeeds });

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

function defaultHtmlContent({ userFeeds }: { userFeeds: NewsFeed[] }) {
  const htmlContent = html`
    <main id="main">
      <section id="feeds">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import Feeds from '/public/components/news/Feeds.js';

    const feedsElement = document.getElementById('feeds');

    if (feedsElement) {
      const feedsApp = h(Feeds, {
        initialFeeds: ${JSON.stringify(userFeeds || [])},
      });

      render(feedsApp, feedsElement);

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
