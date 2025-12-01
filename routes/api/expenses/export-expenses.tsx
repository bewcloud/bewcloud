import { Handlers } from 'fresh/server.ts';

import { Budget, Expense, FreshContextState } from '/lib/types.ts';
import { BudgetModel, ExpenseModel } from '/lib/models/expenses.ts';
import { AppConfig } from '/lib/config.ts';

interface Data {}

export interface RequestBody {}

export interface ResponseBody {
  success: boolean;
  jsonContents: {
    budgets: (Omit<Budget, 'id' | 'user_id' | 'created_at' | 'extra'> & { extra: Record<never, never> })[];
    expenses: (Omit<Expense, 'id' | 'user_id' | 'created_at' | 'extra'> & { extra: Record<never, never> })[];
  };
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!(await AppConfig.isAppEnabled('expenses'))) {
      return new Response('Forbidden', { status: 403 });
    }

    const newExpenses = await ExpenseModel.getAllForExport(context.state.user.id);

    const newBudgets = await BudgetModel.getAllForExport(context.state.user.id);

    const responseBody: ResponseBody = { success: true, jsonContents: { expenses: newExpenses, budgets: newBudgets } };

    return new Response(JSON.stringify(responseBody));
  },
};
