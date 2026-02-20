import page, { RequestHandlerParams } from '/lib/page.ts';

import { AppConfig } from '/lib/config.ts';
import { ArticleModel } from '/lib/models/news.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import { html } from '/public/ts/utils/misc.ts';
import { NewsFeedArticle } from '/lib/types.ts';
import Loading from '/components/Loading.ts';

const titlePrefix = 'News';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams): Promise<Response> {
  if (!(await AppConfig.isAppEnabled('news'))) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
  }

  const userArticles = await ArticleModel.listUnread(user!.id);

  const htmlContent = defaultHtmlContent({ userArticles });

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

function defaultHtmlContent({ userArticles }: { userArticles: NewsFeedArticle[] }) {
  return html`
    <main id="main">
      <section id="articles">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import Articles from '/public/components/news/Articles.js';

    const articlesElement = document.getElementById('articles');

    if (articlesElement) {
      const articlesApp = h(Articles, {
        initialArticles: ${JSON.stringify(userArticles || [])},
      });

      render(articlesApp, articlesElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}

export default page({
  get,
  accessMode: 'user',
});
