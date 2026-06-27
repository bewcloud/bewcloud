import page, { RequestHandlerParams } from '/lib/page.ts';

import { NewsFeed } from '/lib/types.ts';
import { FeedModel } from '/lib/models/news.ts';
import { fetchNewArticles } from '/crons/news.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  feedUrl: string;
}

export interface ResponseBody {
  success: boolean;
  newFeeds: NewsFeed[];
}

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('news'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (requestBody.feedUrl) {
    const newFeed = await FeedModel.create(user!.id, requestBody.feedUrl);

    if (!newFeed) {
      return new Response('Not found', { status: 404 });
    }
  }

  await fetchNewArticles();

  const newFeeds = await FeedModel.list(user!.id);

  const responseBody: ResponseBody = { success: true, newFeeds };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
