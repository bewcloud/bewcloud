import { Handlers } from 'fresh/server.ts';

import { Budget, Expense, FreshContextState } from '/lib/types.ts';
import { deleteExpense, getBudgets, getExpenseById, getExpenses } from '/lib/data/expenses.ts';

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

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (
      !requestBody.id || !requestBody.month || !requestBody.month.match(/^\d{4}-\d{2}$/)
    ) {
      return new Response('Bad request', { status: 400 });
    }

    const expense = await getExpenseById(context.state.user.id, requestBody.id);

    if (!expense) {
      return new Response('Not found', { status: 404 });
    }

    try {
      await deleteExpense(context.state.user.id, requestBody.id);
    } catch (error) {
      console.error(error);
      return new Response(`${error}`, { status: 500 });
    }

    const newExpenses = await getExpenses(context.state.user.id, requestBody.month);

    const newBudgets = await getBudgets(context.state.user.id, requestBody.month);

    const responseBody: ResponseBody = { success: true, newExpenses, newBudgets };

    return new Response(JSON.stringify(responseBody));
  },
};
