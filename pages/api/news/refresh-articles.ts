import page, { RequestHandlerParams } from '/lib/page.ts';

import { NewsFeedArticle } from '/lib/types.ts';
import { ArticleModel, FeedModel } from '/lib/models/news.ts';
import { fetchNewArticles } from '/crons/news.ts';
import { AppConfig } from '/lib/config.ts';

export interface ResponseBody {
  success: boolean;
  newArticles: NewsFeedArticle[];
}

async function post({ user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('news'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const newsFeeds = await FeedModel.list(user!.id);

  if (!newsFeeds.length) {
    return new Response('Not found', { status: 404 });
  }

  await fetchNewArticles(true);

  const newArticles = await ArticleModel.list(user!.id);

  const responseBody: ResponseBody = { success: true, newArticles };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
