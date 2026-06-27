import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { Chart } from 'chart.js/auto';
import { formatNumber } from '/public/ts/utils/misc.ts';
export default function ListBudgets({
  budgets,
  month,
  currency,
  onClickEditBudget
}) {
  const view = useSignal('list');
  const chartRef = useRef(null);
  const totalBudget = {
    id: 'total',
    name: 'Total',
    month,
    value: budgets.reduce((accumulatedValue, budget) => accumulatedValue + budget.value, 0),
    extra: {
      usedValue: budgets.reduce((accumulatedValue, budget) => accumulatedValue + budget.extra.usedValue, 0),
      availableValue: budgets.reduce((accumulatedValue, budget) => accumulatedValue + budget.extra.availableValue, 0)
    }
  };
  function swapView(newView) {
    view.value = view.value === newView ? 'list' : newView;
  }
  useEffect(() => {
    if (view.value === 'chart') {
      const budgetColors = [totalBudget, ...budgets].map((_, index) => index === 0 ? 'rgba(59, 130, 246, 0.8)' : `hsl(${(index - 1) * (360 / budgets.length)}, ${index % 2 ? 85 : 70}%, ${index % 2 ? 55 : 65}%, 0.8)`);
      new Chart(chartRef.current, {
        type: 'doughnut',
        data: {
          labels: [{
            name: 'Available'
          }, ...budgets].map(budget => budget.name),
          datasets: [{
            label: '',
            data: [totalBudget, ...budgets].map(budget => budget.id === 'total' ? budget.extra.availableValue : budget.extra.usedValue),
            backgroundColor: budgetColors,
            borderWidth: 1,
            borderColor: '#222'
          }]
        },
        options: {
          backgroundColor: '#222',
          plugins: {
            legend: {
              position: 'bottom',
              fullSize: true,
              labels: {
                usePointStyle: true,
                pointStyle: 'circle',
                padding: 10
              }
            }
          }
        }
      });
    }
  }, [view.value]);
  return h("section", {
    class: "mx-auto max-w-7xl my-8"
  }, budgets.length === 0 ? h("article", {
    class: "px-6 py-4 font-normal text-center w-full"
  }, h("div", {
    class: "font-medium text-slate-400 text-md"
  }, "No budgets to show for ", month)) : h("section", {
    class: "w-full flex flex-wrap gap-4 justify-center items-center"
  }, view.value === 'list' ? [totalBudget, ...budgets].map(budget => {
    let backgroundColorClass = 'bg-green-600';
    let usedValuePercentage = Math.ceil(100 * budget.extra.usedValue / budget.value);
    if (usedValuePercentage >= 100) {
      usedValuePercentage = 100;
      backgroundColorClass = 'bg-red-600';
    }
    return h("div", {
      onClick: () => budget.id === 'total' ? swapView('chart') : onClickEditBudget(budget.id),
      class: "flex w-full md:w-auto max-w-sm gap-y-4 gap-x-4 rounded shadow-md bg-slate-700 relative cursor-pointer py-4 px-6 hover:opacity-80"
    }, h("article", {
      class: "order-first tracking-tight flex flex-col text-base mr-4"
    }, h("span", {
      class: "font-bold text-lg",
      title: "Amount used from budgeted amount"
    }, formatNumber(currency, budget.extra.usedValue), " of ", formatNumber(currency, budget.value)), h("span", {
      class: "bg-gray-600 h-1.5 w-full block rounded-full mt-2 mx-0",
      title: `${usedValuePercentage}% of budget used`
    }, h("span", {
      class: `${backgroundColorClass} w-0 block h-1.5 rounded-full`,
      style: {
        width: `${usedValuePercentage}%`
      }
    })), h("span", {
      class: "mt-2 font-normal text-gray-400"
    }, budget.name)), h("span", {
      class: "text-lg text-right text-gray-200",
      title: "Amount available from budgeted amount"
    }, formatNumber(currency, budget.extra.availableValue)));
  }) : h("section", {
    class: "p-4 rounded-lg shadow-sm cursor-pointer",
    onClick: () => swapView('list')
  }, h("canvas", {
    ref: chartRef
  }))));
}