import page, { RequestHandlerParams } from '/lib/page.ts';

import { Budget, Expense } from '/lib/types.ts';
import { BudgetModel, ExpenseModel } from '/lib/models/expenses.ts';
import { AppConfig } from '/lib/config.ts';

export interface ResponseBody {
  success: boolean;
  jsonContents: {
    budgets: (Omit<Budget, 'id' | 'user_id' | 'created_at' | 'extra'> & { extra: Record<never, never> })[];
    expenses: (Omit<Expense, 'id' | 'user_id' | 'created_at' | 'extra'> & { extra: Record<never, never> })[];
  };
}

async function post({ user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('expenses'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const newExpenses = await ExpenseModel.getAllForExport(user!.id);

  const newBudgets = await BudgetModel.getAllForExport(user!.id);

  const responseBody: ResponseBody = { success: true, jsonContents: { expenses: newExpenses, budgets: newBudgets } };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
