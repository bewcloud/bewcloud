import { RouteHandler } from 'fresh';

import { Budget, Expense, FreshContextState } from '/lib/types.ts';
import { BudgetModel, ExpenseModel } from '/lib/models/expenses.ts';

interface Data {}

export interface RequestBody {
  id: string;
  month: string;
}

export interface ResponseBody {
  success: boolean;
  newExpenses: Expense[];
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
      !requestBody.id || !requestBody.month || !requestBody.month.match(/^\d{4}-\d{2}$/)
    ) {
      return new Response('Bad request', { status: 400 });
    }

    const expense = await ExpenseModel.getById(context.state.user.id, requestBody.id);

    if (!expense) {
      return new Response('Not found', { status: 404 });
    }

    try {
      await ExpenseModel.delete(context.state.user.id, requestBody.id);
    } catch (error) {
      console.error(error);
      return new Response(`${error}`, { status: 500 });
    }

    const newExpenses = await ExpenseModel.list(context.state.user.id, requestBody.month);

    const newBudgets = await BudgetModel.list(context.state.user.id, requestBody.month);

    const responseBody: ResponseBody = { success: true, newExpenses, newBudgets };

    return new Response(JSON.stringify(responseBody));
  },
};
