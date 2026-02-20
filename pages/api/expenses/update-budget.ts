import page, { RequestHandlerParams } from '/lib/page.ts';

import { Budget } from '/lib/types.ts';
import { BudgetModel } from '/lib/models/expenses.ts';
import { AppConfig } from '/lib/config.ts';

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

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('expenses'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (
    !requestBody.id || !requestBody.name || !requestBody.month || !requestBody.month.match(/^\d{4}-\d{2}$/) ||
    !requestBody.value || Number.isNaN(requestBody.value) || !requestBody.currentMonth ||
    !requestBody.currentMonth.match(/^\d{4}-\d{2}$/)
  ) {
    return new Response('Bad request', { status: 400 });
  }

  const budget = await BudgetModel.getById(user!.id, requestBody.id);

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

  const newBudgets = await BudgetModel.list(user!.id, requestBody.currentMonth);

  const responseBody: ResponseBody = { success: true, newBudgets };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
