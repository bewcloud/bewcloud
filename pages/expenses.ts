import page, { RequestHandlerParams } from '/lib/page.ts';

import { Budget, Expense, SupportedCurrencySymbol } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';
import { BudgetModel, ExpenseModel, generateMonthlyBudgetsAndExpenses } from '/lib/models/expenses.ts';
import { html } from '/public/ts/utils/misc.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import Loading from '/components/Loading.ts';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('expenses'))) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
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

  let userBudgets = await BudgetModel.list(user!.id, initialMonth);

  let userExpenses = await ExpenseModel.list(user!.id, initialMonth);

  // If there are no budgets or expenses, and the selected month is in the future, generate the month's budgets and expenses
  if (userBudgets.length === 0 && userExpenses.length === 0 && initialMonth >= currentMonth) {
    await generateMonthlyBudgetsAndExpenses(user!.id, initialMonth);

    userBudgets = await BudgetModel.list(user!.id, initialMonth);
    userExpenses = await ExpenseModel.list(user!.id, initialMonth);
  }

  const currency = user!.extra.expenses_currency || '$';

  const htmlContent = defaultHtmlContent({ userBudgets, userExpenses, initialMonth, currency });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix: 'Expenses',
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent({ userBudgets, userExpenses, initialMonth, currency }: {
  userBudgets: Budget[];
  userExpenses: Expense[];
  initialMonth: string;
  currency: SupportedCurrencySymbol;
}) {
  return html`
    <main id="main">
      <section id="main-expenses">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import MainExpenses from '/public/components/expenses/MainExpenses.js';

    const mainExpensesElement = document.getElementById('main-expenses');

    if (mainExpensesElement) {
      const mainExpensesApp = h(MainExpenses, {
        initialBudgets: ${JSON.stringify(userBudgets || [])},
        initialExpenses: ${JSON.stringify(userExpenses || [])},
        initialMonth: ${JSON.stringify(initialMonth)},
        currency: ${JSON.stringify(currency)},
      });

      render(mainExpensesApp, mainExpensesElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}

export default page({
  get,
  accessMode: 'user',
});
