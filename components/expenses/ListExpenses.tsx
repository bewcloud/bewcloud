import { Expense, SupportedCurrencySymbol } from '/lib/types.ts';
import { formatNumber } from '/lib/utils/misc.ts';
interface ListExpensesProps {
  expenses: Expense[];
  currency: SupportedCurrencySymbol;
  onClickEditExpense: (expenseId: string) => void;
}

export default function ListExpenses(
  {
    expenses,
    currency,
    onClickEditExpense,
  }: ListExpensesProps,
) {
  const dateFormatOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };

  // Force timeZone to UTC for the server rendering
  if (typeof window === 'undefined') {
    dateFormatOptions.timeZone = 'UTC';
  }

  const dateFormat = new Intl.DateTimeFormat('en-US', dateFormatOptions);

  return (
    <section class='mx-auto max-w-7xl my-8 mt-12'>
      {expenses.length === 0
        ? (
          <article class='px-6 py-4 font-normal text-center w-full'>
            <div class='font-medium text-slate-400 text-md'>No expenses to show</div>
          </article>
        )
        : (
          <section class='w-full overflow-x-auto'>
            <table class='w-full border-collapse text-gray-200 rounded-lg overflow-hidden'>
              <thead class='bg-slate-900 hidden md:table-header-group'>
                <tr>
                  <th class='px-6 py-3 text-left text-sm font-normal'>Description</th>
                  <th class='px-6 py-3 text-left text-sm font-normal'>Budget</th>
                  <th class='px-6 py-3 text-left text-sm font-normal'>Date</th>
                  <th class='px-6 py-3 text-left text-sm font-normal'>Cost</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    class='text-white border-t border-slate-700 hover:bg-slate-600 transition-colors even:bg-slate-700 odd:bg-slate-800 cursor-pointer flex md:table-row flex-row flex-wrap my-4 mx-4 md:my-0 md:mx-0 rounded md:rounded-none shadow-md md:shadow-none relative py-4 md:py-0 px-6 md:px-0'
                    onClick={() => onClickEditExpense(expense.id)}
                  >
                    <td class='md:px-6 md:py-3 flex-[50] mx-2 md:mx-0'>{expense.description}</td>
                    <td class='md:px-6 md:py-3 flex-[20] mx-2 md:mx-0 text-gray-400 md:text-gray-300'>
                      {expense.budget}
                    </td>
                    <td class='md:px-6 md:py-3 flex-[15] mx-2 md:mx-0 text-gray-400 md:text-gray-300'>
                      {dateFormat.format(new Date(expense.date))}
                    </td>
                    <td class='md:px-6 md:py-3 flex-[15] mx-2 md:mx-0 font-bold md:font-semibold'>
                      {formatNumber(currency, expense.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
    </section>
  );
}
