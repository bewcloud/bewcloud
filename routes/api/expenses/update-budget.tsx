import { RouteHandler } from 'fresh';

import { Budget, FreshContextState } from '/lib/types.ts';
import { BudgetModel } from '/lib/models/expenses.ts';

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

export const handler: RouteHandler<Data, FreshContextState> = {
  async POST(context) {
    const request = context.req;

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

    const budget = await BudgetModel.getById(context.state.user.id, requestBody.id);

    if (!budget) {
      return new Response('Not found', { status: 404 });
    }

    budget.name = requestBody.name;
    budget.month = requestBody.month;
    budget.value = requestBody.value;

    try {
      await BudgetModel.update(budget);
    } catch (error) {
      console.error(error);
      return new Response(`${error}`, { status: 500 });
    }

    const newBudgets = await BudgetModel.list(context.state.user.id, requestBody.currentMonth);

    const responseBody: ResponseBody = { success: true, newBudgets };

    return new Response(JSON.stringify(responseBody));
  },
};
