import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { formatInputToNumber } from '/public/ts/utils/misc.ts';
export default function BudgetModal({
  isOpen,
  budget,
  onClickSave,
  onClickDelete,
  onClose,
  shouldResetForm
}) {
  const newBudgetName = useSignal(budget?.name ?? '');
  const newBudgetMonth = useSignal(budget?.month ?? new Date().toISOString().substring(0, 10));
  const newBudgetValue = useSignal(budget?.value ?? 100);
  const resetForm = () => {
    newBudgetName.value = '';
    newBudgetMonth.value = new Date().toISOString().substring(0, 10);
    newBudgetValue.value = 100;
  };
  useEffect(() => {
    if (budget) {
      newBudgetName.value = budget.name;
      newBudgetMonth.value = `${budget.month}-15`;
      newBudgetValue.value = budget.value;
    }
    if (shouldResetForm) {
      resetForm();
    }
  }, [budget, shouldResetForm]);
  return h(Fragment, null, h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`
  }), h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`
  }, h("h1", {
    class: "text-2xl font-semibold my-5"
  }, budget ? 'Edit Budget' : 'Create New Budget'), h("section", {
    class: "py-5 my-2 border-y border-slate-500"
  }, h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "budget_name"
  }, "Name"), h("input", {
    class: "input-field",
    type: "text",
    name: "budget_name",
    id: "budget_name",
    value: newBudgetName.value,
    onInput: event => {
      newBudgetName.value = event.currentTarget.value;
    },
    placeholder: "Amazing"
  })), h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "budget_month"
  }, "Month"), h("input", {
    class: "input-field",
    type: "date",
    name: "budget_month",
    id: "budget_month",
    value: newBudgetMonth.value,
    onInput: event => {
      newBudgetMonth.value = event.currentTarget.value;
    },
    placeholder: "2025-01-01"
  })), h("fieldset", {
    class: "block mb-2"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "budget_value"
  }, "Value"), h("input", {
    class: "input-field",
    type: "text",
    name: "budget_value",
    id: "budget_value",
    value: newBudgetValue.value,
    onInput: event => {
      newBudgetValue.value = event.currentTarget.value;
    },
    inputmode: "decimal",
    placeholder: "100"
  }))), h("footer", {
    class: "flex justify-between"
  }, budget ? h("button", {
    class: "px-5 py-2 bg-red-600 text-white cursor-pointer rounded-md mr-2 opacity-30 hover:opacity-100",
    onClick: () => onClickDelete(),
    type: "button"
  }, "Delete") : null, h("button", {
    class: "px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md mr-2",
    onClick: () => onClose(),
    type: "button"
  }, budget ? 'Cancel' : 'Close'), h("button", {
    class: "px-5 py-2 bg-slate-700 hover:bg-slate-500 text-white cursor-pointer rounded-md ml-2",
    onClick: () => onClickSave(newBudgetName.value, newBudgetMonth.value.substring(0, 7), formatInputToNumber(newBudgetValue.value)),
    type: "button"
  }, budget ? 'Update' : 'Create'))));
}