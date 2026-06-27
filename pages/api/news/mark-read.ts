import page, { RequestHandlerParams } from '/lib/page.ts';

import { ArticleModel } from '/lib/models/news.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  articleId: string;
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
      await ArticleModel.markAllRead(user!.id);
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
