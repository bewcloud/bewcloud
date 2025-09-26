import { RouteHandler } from 'fresh';

import { FreshContextState } from '/lib/types.ts';
import { ArticleModel } from '/lib/models/news.ts';

interface Data {}

export interface RequestBody {
  articleId: string;
}

export interface ResponseBody {
  success: boolean;
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async POST(context) {
    const request = context.req;

    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (requestBody.articleId) {
      if (requestBody.articleId === 'all') {
        await ArticleModel.markAllRead(context.state.user.id);
      } else {
        const article = await ArticleModel.get(requestBody.articleId, context.state.user.id);

        if (!article) {
          return new Response('Not found', { status: 404 });
        }

        article.is_read = true;

        await ArticleModel.update(article);
      }
    }

    const responseBody: ResponseBody = { success: true };

    return new Response(JSON.stringify(responseBody));
  },
};
