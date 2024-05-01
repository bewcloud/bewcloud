import { Handlers, PageProps } from 'fresh/server.ts';

import { FreshContextState, NewsFeedArticle } from '/lib/types.ts';
import { isAppEnabled } from '/lib/config.ts';
import { getNewsArticles } from '/lib/data/news.ts';
import Articles from '/islands/news/Articles.tsx';

interface Data {
  userArticles: NewsFeedArticle[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    if (!isAppEnabled('news')) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/dashboard` } });
    }

    const userArticles = await getNewsArticles(context.state.user.id);

    return await context.render({ userArticles });
  },
};

export default function News({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <Articles initialArticles={data?.userArticles || []} />
    </main>
  );
}
