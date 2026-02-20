import page, { RequestHandlerParams } from '/lib/page.ts';

import { NewsFeed } from '/lib/types.ts';
import { FeedModel } from '/lib/models/news.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  feedId: string;
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

  if (requestBody.feedId) {
    const newsFeed = await FeedModel.get(requestBody.feedId, user!.id);

    if (!newsFeed) {
      return new Response('Not found', { status: 404 });
    }

    await FeedModel.delete(requestBody.feedId, user!.id);
  }

  const newFeeds = await FeedModel.list(user!.id);

  const responseBody: ResponseBody = { success: true, newFeeds };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
