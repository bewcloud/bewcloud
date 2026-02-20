import page, { RequestHandlerParams } from '/lib/page.ts';

import { ExpenseModel } from '/lib/models/expenses.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  name: string;
}

export interface ResponseBody {
  success: boolean;
  suggestions: string[];
}

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('expenses'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (!requestBody.name || requestBody.name.length < 2) {
    return new Response('Bad request', { status: 400 });
  }

  const suggestions = await ExpenseModel.listSuggestions(
    user!.id,
    requestBody.name,
  );

  const responseBody: ResponseBody = { success: true, suggestions };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
