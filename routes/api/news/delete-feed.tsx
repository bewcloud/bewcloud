import { Handlers } from 'fresh/server.ts';

import { FreshContextState, NewsFeed } from '/lib/types.ts';
import { deleteNewsFeed, getNewsFeed, getNewsFeeds } from '/lib/data/news.ts';

interface Data {}

export interface RequestBody {
  feedId: string;
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

    if (requestBody.feedId) {
      const newsFeed = await getNewsFeed(requestBody.feedId, context.state.user.id);

      if (!newsFeed) {
        return new Response('Not found', { status: 404 });
      }

      await deleteNewsFeed(requestBody.feedId);
    }

    const newFeeds = await getNewsFeeds(context.state.user.id);

    const responseBody: ResponseBody = { success: true, newFeeds };

    return new Response(JSON.stringify(responseBody));
  },
};
