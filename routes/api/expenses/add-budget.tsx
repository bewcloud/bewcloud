import { Handlers } from 'fresh/server.ts';

import { Budget, FreshContextState } from '/lib/types.ts';
import { createBudget, getBudgets } from '/lib/data/expenses.ts';

interface Data {}

export interface RequestBody {
  name: string;
  month: string;
  value: number;
  currentMonth: string;
}

export interface ResponseBody {
  success: boolean;
  newBudgets: Budget[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (
      !requestBody.name || !requestBody.month || !requestBody.month.match(/^\d{4}-\d{2}$/) || !requestBody.value ||
      Number.isNaN(requestBody.value) || !requestBody.currentMonth || !requestBody.currentMonth.match(/^\d{4}-\d{2}$/)
    ) {
      return new Response('Bad request', { status: 400 });
    }

    try {
      const newBudget = await createBudget(
        context.state.user.id,
        requestBody.name,
        requestBody.month,
        requestBody.value,
      );

      if (!newBudget) {
        throw new Error('Failed to add budget!');
      }
    } catch (error) {
      console.error(error);
      return new Response(`${error}`, { status: 500 });
    }

    const newBudgets = await getBudgets(context.state.user.id, requestBody.currentMonth);

    const responseBody: ResponseBody = { success: true, newBudgets };

    return new Response(JSON.stringify(responseBody));
  },
};
