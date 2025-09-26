import { Budget, FreshContextState } from '/lib/types.ts';
import { BudgetModel } from '/lib/models/expenses.ts';

interface Data {}

export interface RequestBody {
  id: string;
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
      !requestBody.id || !requestBody.currentMonth || !requestBody.currentMonth.match(/^\d{4}-\d{2}$/)
    ) {
      return new Response('Bad request', { status: 400 });
    }

    const budget = await BudgetModel.getById(context.state.user.id, requestBody.id);

    if (!budget) {
      return new Response('Not found', { status: 404 });
    }

    try {
      await BudgetModel.delete(context.state.user.id, requestBody.id);
    } catch (error) {
      console.error(error);
      return new Response(`${error}`, { status: 500 });
    }

    const newBudgets = await BudgetModel.list(context.state.user.id, requestBody.currentMonth);

    const responseBody: ResponseBody = { success: true, newBudgets };

    return new Response(JSON.stringify(responseBody));
  },
};
