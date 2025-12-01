import { Handlers } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { ExpenseModel } from '/lib/models/expenses.ts';
import { AppConfig } from '/lib/config.ts';

interface Data {}

export interface RequestBody {
  name: string;
}

export interface ResponseBody {
  success: boolean;
  suggestions: string[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!(await AppConfig.isAppEnabled('expenses'))) {
      return new Response('Forbidden', { status: 403 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (!requestBody.name || requestBody.name.length < 2) {
      return new Response('Bad request', { status: 400 });
    }

    const suggestions = await ExpenseModel.listSuggestions(
      context.state.user.id,
      requestBody.name,
    );

    const responseBody: ResponseBody = { success: true, suggestions };

    return new Response(JSON.stringify(responseBody));
  },
};
