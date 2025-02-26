import { Handlers } from 'fresh/server.ts';

import { Budget, FreshContextState } from '/lib/types.ts';
import { getBudgetById, getBudgets, updateBudget } from '/lib/data/expenses.ts';

interface Data {}

export interface RequestBody {
  id: string;
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
      !requestBody.id || !requestBody.name || !requestBody.month || !requestBody.month.match(/^\d{4}-\d{2}$/) ||
      !requestBody.value || Number.isNaN(requestBody.value) || !requestBody.currentMonth ||
      !requestBody.currentMonth.match(/^\d{4}-\d{2}$/)
    ) {
      return new Response('Bad request', { status: 400 });
    }

    const budget = await getBudgetById(context.state.user.id, requestBody.id);

    if (!budget) {
      return new Response('Not found', { status: 404 });
    }

    budget.name = requestBody.name;
    budget.month = requestBody.month;
    budget.value = requestBody.value;

    try {
      await updateBudget(budget);
    } catch (error) {
      console.error(error);
      return new Response(`${error}`, { status: 500 });
    }

    const newBudgets = await getBudgets(context.state.user.id, requestBody.currentMonth);

    const responseBody: ResponseBody = { success: true, newBudgets };

    return new Response(JSON.stringify(responseBody));
  },
};
