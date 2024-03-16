import { Handlers } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { getNewsArticle, markAllArticlesRead, updateNewsArticle } from '/lib/data/news.ts';

interface Data {}

export interface RequestBody {
  articleId: string;
}

export interface ResponseBody {
  success: boolean;
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (requestBody.articleId) {
      if (requestBody.articleId === 'all') {
        await markAllArticlesRead(context.state.user.id);
      } else {
        const article = await getNewsArticle(requestBody.articleId, context.state.user.id);

        if (!article) {
          return new Response('Not found', { status: 404 });
        }

        article.is_read = true;

        await updateNewsArticle(article);
      }
    }

    const responseBody: ResponseBody = { success: true };

    return new Response(JSON.stringify(responseBody));
  },
};
