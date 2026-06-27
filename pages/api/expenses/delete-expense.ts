import page, { RequestHandlerParams } from '/lib/page.ts';

import { Budget, Expense } from '/lib/types.ts';
import { BudgetModel, ExpenseModel } from '/lib/models/expenses.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  id: string;
  month: string;
}

export interface ResponseBody {
  success: boolean;
  newExpenses: Expense[];
  newBudgets: Budget[];
}

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('expenses'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (
    !requestBody.id || !requestBody.month || !requestBody.month.match(/^\d{4}-\d{2}$/)
  ) {
    return new Response('Bad request', { status: 400 });
  }

  const expense = await ExpenseModel.getById(user!.id, requestBody.id);

  if (!expense) {
    return new Response('Not found', { status: 404 });
  }

  try {
    await ExpenseModel.delete(user!.id, requestBody.id);
  } catch (error) {
    console.error(error);
    return new Response(`${error}`, { status: 500 });
  }

  const newExpenses = await ExpenseModel.list(user!.id, requestBody.month);

  const newBudgets = await BudgetModel.list(user!.id, requestBody.month);

  const responseBody: ResponseBody = { success: true, newExpenses, newBudgets };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
