import { Handlers } from 'fresh/server.ts';

import { Budget, Expense, FreshContextState } from '/lib/types.ts';
import { BudgetModel, ExpenseModel } from '/lib/models/expenses.ts';

interface Data {}

export interface RequestBody {
  cost: number;
  description: string;
  budget: string;
  date: string;
  is_recurring: boolean;
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
      !requestBody.cost || Number.isNaN(requestBody.cost) || !requestBody.description || !requestBody.month ||
      !requestBody.month.match(/^\d{4}-\d{2}$/)
    ) {
      return new Response('Bad request', { status: 400 });
    }

    if (!requestBody.budget) {
      requestBody.budget = 'Misc';
    }

    if (!requestBody.date) {
      requestBody.date = new Date().toISOString().substring(0, 10);
    }

    if (!requestBody.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Response('Bad request', { status: 400 });
    }

    if (!requestBody.is_recurring) {
      requestBody.is_recurring = false;
    }

    try {
      const newExpense = await ExpenseModel.create(
        context.state.user.id,
        requestBody.cost,
        requestBody.description,
        requestBody.budget,
        requestBody.date,
        requestBody.is_recurring,
      );

      if (!newExpense) {
        throw new Error('Failed to add expense!');
      }
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
