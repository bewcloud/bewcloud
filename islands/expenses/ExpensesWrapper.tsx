import { Budget, Expense, SupportedCurrencySymbol } from '/lib/types.ts';
import MainExpenses from '/components/expenses/MainExpenses.tsx';

interface ExpensesWrapperProps {
  initialBudgets: Budget[];
  initialExpenses: Expense[];
  initialMonth: string;
  currency: SupportedCurrencySymbol;
}

// This wrapper is necessary because islands need to be the first frontend component, but they don't support functions as props, so the more complex logic needs to live in the component itself
export default function ExpensesWrapper(
  { initialBudgets, initialExpenses, initialMonth, currency }: ExpensesWrapperProps,
) {
  return (
    <MainExpenses
      initialBudgets={initialBudgets}
      initialExpenses={initialExpenses}
      initialMonth={initialMonth}
      currency={currency}
    />
  );
}
