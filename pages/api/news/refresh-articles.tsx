import { FreshContextState, NewsFeedArticle } from '/lib/types.ts';
import { ArticleModel, FeedModel } from '/lib/models/news.ts';
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

    const newsFeeds = await FeedModel.list(context.state.user.id);

    if (!newsFeeds.length) {
      return new Response('Not found', { status: 404 });
    }

    await fetchNewArticles(true);

    const newArticles = await ArticleModel.list(context.state.user.id);

    const responseBody: ResponseBody = { success: true, newArticles };

    return new Response(JSON.stringify(responseBody));
  },
};
