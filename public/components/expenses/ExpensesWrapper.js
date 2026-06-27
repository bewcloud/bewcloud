import MainExpenses from "/public/components/expenses/MainExpenses.js";
export default function ExpensesWrapper({
  initialBudgets,
  initialExpenses,
  initialMonth,
  currency
}) {
  return h(MainExpenses, {
    initialBudgets: initialBudgets,
    initialExpenses: initialExpenses,
    initialMonth: initialMonth,
    currency: currency
  });
}