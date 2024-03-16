import { Handlers } from 'fresh/server.ts';

import { FreshContextState, NewsFeedArticle } from '/lib/types.ts';
import { getNewsArticles, getNewsFeeds } from '/lib/data/news.ts';
import { fetchNewArticles } from '/crons/news.ts';

interface Data {}

export interface RequestBody {}

export interface ResponseBody {
  success: boolean;
  newArticles: NewsFeedArticle[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const newsFeeds = await getNewsFeeds(context.state.user.id);

    if (!newsFeeds.length) {
      return new Response('Not found', { status: 404 });
    }

    await fetchNewArticles(true);

    const newArticles = await getNewsArticles(context.state.user.id);

    const responseBody: ResponseBody = { success: true, newArticles };

    return new Response(JSON.stringify(responseBody));
  },
};
