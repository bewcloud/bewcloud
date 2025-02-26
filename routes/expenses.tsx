import { Handlers, PageProps } from 'fresh/server.ts';

import { Budget, Expense, FreshContextState, SupportedCurrencySymbol } from '/lib/types.ts';
import { isAppEnabled } from '/lib/config.ts';
import { generateMonthlyBudgetsAndExpenses, getBudgets, getExpenses } from '/lib/data/expenses.ts';
import ExpensesWrapper from '/islands/expenses/ExpensesWrapper.tsx';

interface Data {
  userBudgets: Budget[];
  userExpenses: Expense[];
  initialMonth: string;
  currency: SupportedCurrencySymbol;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    if (!isAppEnabled('expenses')) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/files` } });
    }

    const searchParams = new URL(request.url).searchParams;

    let initialMonth = searchParams.get('month') || new Date().toISOString().substring(0, 7);

    const currentMonth = new Date().toISOString().substring(0, 7);
    const nextMonth = new Date(new Date(currentMonth).setUTCMonth(new Date(currentMonth).getUTCMonth() + 1))
      .toISOString()
      .substring(0, 7);

    // Send invalid months (format) back to current month
    if (!initialMonth.match(/^\d{4}-\d{2}$/)) {
      initialMonth = currentMonth;
    }

    // Reset to next month if the selected month is too far in the future
    if (initialMonth > nextMonth) {
      initialMonth = nextMonth;
    }

    let userBudgets = await getBudgets(context.state.user.id, initialMonth);

    let userExpenses = await getExpenses(context.state.user.id, initialMonth);

    // If there are no budgets or expenses, and the selected month is in the future, generate the month's budgets and expenses
    if (userBudgets.length === 0 && userExpenses.length === 0 && initialMonth >= currentMonth) {
      await generateMonthlyBudgetsAndExpenses(context.state.user.id, initialMonth);

      userBudgets = await getBudgets(context.state.user.id, initialMonth);
      userExpenses = await getExpenses(context.state.user.id, initialMonth);
    }

    const currency = context.state.user.extra.expenses_currency || '$';

    return await context.render({ userBudgets, userExpenses, initialMonth, currency });
  },
};

export default function ExpensesPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <ExpensesWrapper
        initialBudgets={data.userBudgets}
        initialExpenses={data.userExpenses}
        initialMonth={data.initialMonth}
        currency={data.currency}
      />
    </main>
  );
}
