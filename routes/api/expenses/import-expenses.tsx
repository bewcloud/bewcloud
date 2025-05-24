import { Handlers } from 'fresh/server.ts';

import { Budget, Expense, FreshContextState } from '/lib/types.ts';
import { concurrentPromises } from '/lib/utils/misc.ts';
import { BudgetModel, deleteAllBudgetsAndExpenses, ExpenseModel } from '/lib/models/expenses.ts';

interface Data {}

export interface RequestBody {
  budgets: Pick<Budget, 'name' | 'month' | 'value'>[];
  expenses: Pick<Expense, 'cost' | 'description' | 'budget' | 'date' | 'is_recurring'>[];
  month: string;
  replace: boolean;
}

export interface ResponseBody {
  success: boolean;
  newBudgets: Budget[];
  newExpenses: Expense[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (
      (requestBody.budgets.length === 0 && requestBody.expenses.length === 0) || !requestBody.month ||
      !requestBody.month.match(/^\d{4}-\d{2}$/)
    ) {
      return new Response('Bad request', { status: 400 });
    }

    if (requestBody.replace) {
      await deleteAllBudgetsAndExpenses(context.state.user.id);
    }

    try {
      await concurrentPromises(
        requestBody.budgets.map((budget) => () =>
          BudgetModel.create(context.state.user!.id, budget.name, budget.month, budget.value)
        ),
        5,
      );

      await concurrentPromises(
        requestBody.expenses.map((expense) => () =>
          ExpenseModel.create(
            context.state.user!.id,
            expense.cost,
            expense.description,
            expense.budget,
            expense.date,
            expense.is_recurring ?? false,
            { skipRecalculation: true, skipBudgetMatching: true, skipBudgetCreation: true },
          )
        ),
        5,
      );
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
