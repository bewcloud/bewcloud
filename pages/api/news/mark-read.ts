import page, { RequestHandlerParams } from '/lib/page.ts';

import { ArticleModel, FeedModel } from '/lib/models/news.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  articleId: string;
  /** Only used when `articleId` is `all`, to limit which feed's articles are marked as read */
  feedId?: string;
}

export interface ResponseBody {
  success: boolean;
}

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('news'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (requestBody.articleId) {
    if (requestBody.articleId === 'all') {
      if (requestBody.feedId !== undefined) {
        if (typeof requestBody.feedId !== 'string' || requestBody.feedId === '') {
          return new Response('Bad Request', { status: 400 });
        }

        const feed = await FeedModel.get(requestBody.feedId, user!.id);

        if (!feed) {
          return new Response('Not found', { status: 404 });
        }
      }

      await ArticleModel.markAllRead(user!.id, requestBody.feedId);
    } else {
      const article = await ArticleModel.get(requestBody.articleId, user!.id);

      if (!article) {
        return new Response('Not found', { status: 404 });
      }

      article.is_read = true;

      await ArticleModel.update(article);
    }
  }

  const responseBody: ResponseBody = { success: true };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
