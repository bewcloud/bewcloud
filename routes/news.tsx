import { PageProps, RouteHandler } from 'fresh';

import { FreshContextState, NewsFeedArticle } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';
import { ArticleModel } from '/lib/models/news.ts';
import Articles from '/islands/news/Articles.tsx';

interface Data {
  userArticles: NewsFeedArticle[];
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async GET(context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    if (!(await AppConfig.isAppEnabled('news'))) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/dashboard` } });
    }

    const userArticles = await ArticleModel.list(context.state.user.id);

    return { data: { userArticles } };
  },
};

export default function News({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <Articles initialArticles={data?.userArticles || []} />
    </main>
  );
}
