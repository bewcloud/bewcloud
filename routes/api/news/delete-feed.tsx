import { RouteHandler } from 'fresh';

import { FreshContextState, NewsFeed } from '/lib/types.ts';
import { FeedModel } from '/lib/models/news.ts';

interface Data {}

export interface RequestBody {
  feedId: string;
}

export interface ResponseBody {
  success: boolean;
  newFeeds: NewsFeed[];
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async POST(context) {
    const request = context.req;

    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (requestBody.feedId) {
      const newsFeed = await FeedModel.get(requestBody.feedId, context.state.user.id);

      if (!newsFeed) {
        return new Response('Not found', { status: 404 });
      }

      await FeedModel.delete(requestBody.feedId, context.state.user.id);
    }

    const newFeeds = await FeedModel.list(context.state.user.id);

    const responseBody: ResponseBody = { success: true, newFeeds };

    return new Response(JSON.stringify(responseBody));
  },
};
