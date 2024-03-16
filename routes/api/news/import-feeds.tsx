import { Handlers } from 'fresh/server.ts';

import { FreshContextState, NewsFeed } from '/lib/types.ts';
import { concurrentPromises } from '/lib/utils.ts';
import { createNewsFeed, getNewsFeeds } from '/lib/data/news.ts';
import { fetchNewArticles } from '/crons/news.ts';

interface Data {}

export interface RequestBody {
  feedUrls: string[];
}

export interface ResponseBody {
  success: boolean;
  newFeeds: NewsFeed[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (requestBody.feedUrls) {
      if (requestBody.feedUrls.length === 0) {
        return new Response('Not found', { status: 404 });
      }

      await concurrentPromises(
        requestBody.feedUrls.map((feedUrl) => () => createNewsFeed(context.state.user!.id, feedUrl)),
        5,
      );
    }

    await fetchNewArticles();

    const newFeeds = await getNewsFeeds(context.state.user.id);

    const responseBody: ResponseBody = { success: true, newFeeds };

    return new Response(JSON.stringify(responseBody));
  },
};
