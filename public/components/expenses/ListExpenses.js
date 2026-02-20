import { formatNumber } from '/public/ts/utils/misc.ts';
export default function ListExpenses({
  expenses,
  currency,
  onClickEditExpense
}) {
  const dateFormatOptions = {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  };
  const dateFormat = new Intl.DateTimeFormat('en-US', dateFormatOptions);
  return h("section", {
    class: "mx-auto max-w-7xl my-8 mt-12"
  }, expenses.length === 0 ? h("article", {
    class: "px-6 py-4 font-normal text-center w-full"
  }, h("div", {
    class: "font-medium text-slate-400 text-md"
  }, "No expenses to show")) : h("section", {
    class: "w-full overflow-x-auto"
  }, h("table", {
    class: "w-full border-collapse text-gray-200 rounded-lg overflow-hidden"
  }, h("thead", {
    class: "bg-slate-900 hidden md:table-header-group"
  }, h("tr", null, h("th", {
    class: "px-6 py-3 text-left text-sm font-normal"
  }, "Description"), h("th", {
    class: "px-6 py-3 text-left text-sm font-normal"
  }, "Budget"), h("th", {
    class: "px-6 py-3 text-left text-sm font-normal"
  }, "Date"), h("th", {
    class: "px-6 py-3 text-left text-sm font-normal"
  }, "Cost"))), h("tbody", null, expenses.map(expense => h("tr", {
    key: expense.id,
    class: "text-white border-t border-slate-700 hover:bg-slate-600 transition-colors even:bg-slate-700 odd:bg-slate-800 cursor-pointer flex md:table-row flex-row flex-wrap my-4 mx-4 md:my-0 md:mx-0 rounded md:rounded-none shadow-md md:shadow-none relative py-4 md:py-0 px-6 md:px-0",
    onClick: () => onClickEditExpense(expense.id)
  }, h("td", {
    class: "md:px-6 md:py-3 flex-50 mx-2 md:mx-0"
  }, expense.description), h("td", {
    class: "md:px-6 md:py-3 flex-20 mx-2 md:mx-0 text-gray-400 md:text-gray-300"
  }, expense.budget), h("td", {
    class: "md:px-6 md:py-3 flex-15 mx-2 md:mx-0 text-gray-400 md:text-gray-300"
  }, dateFormat.format(new Date(expense.date))), h("td", {
    class: "md:px-6 md:py-3 flex-15 mx-2 md:mx-0 font-bold md:font-semibold"
  }, formatNumber(currency, expense.cost))))))));
}