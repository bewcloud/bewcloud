import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { Budget, Expense } from '/lib/types.ts';
import { formatInputToNumber } from '/lib/utils/misc.ts';

import {
  RequestBody as SuggestionsRequestBody,
  ResponseBody as SuggestionsResponse,
} from '/routes/api/expenses/auto-complete.tsx';

interface ExpenseModalProps {
  isOpen: boolean;
  expense: Expense | null;
  budgets: Budget[];
  onClickSave: (
    newExpenseCost: number,
    newExpenseDescription: string,
    newExpenseBudget: string,
    newExpenseDate: string,
    newExpenseIsRecurring: boolean,
  ) => Promise<void>;
  onClickDelete: () => Promise<void>;
  onClose: () => void;
  shouldResetForm: boolean;
}

export default function ExpenseModal(
  { isOpen, expense, budgets, onClickSave, onClickDelete, onClose, shouldResetForm }: ExpenseModalProps,
) {
  const newExpenseCost = useSignal<number | string>(expense?.cost ?? '');
  const newExpenseDescription = useSignal<string>(expense?.description ?? '');
  const newExpenseBudget = useSignal<string>(expense?.budget ?? 'Misc');
  const newExpenseDate = useSignal<string>(expense?.date ?? '');
  const newExpenseIsRecurring = useSignal<boolean>(expense?.is_recurring ?? false);
  const suggestions = useSignal<string[]>([]);
  const showSuggestions = useSignal<boolean>(false);

  const resetForm = () => {
    newExpenseCost.value = '';
    newExpenseDescription.value = '';
    newExpenseBudget.value = 'Misc';
    newExpenseDate.value = '';
    newExpenseIsRecurring.value = false;
  };

  useEffect(() => {
    if (expense) {
      newExpenseCost.value = expense.cost;
      newExpenseDescription.value = expense.description;
      newExpenseBudget.value = expense.budget;
      newExpenseDate.value = expense.date;
      newExpenseIsRecurring.value = expense.is_recurring;
      showSuggestions.value = false;
    }

    if (shouldResetForm) {
      resetForm();
    }
  }, [expense, shouldResetForm]);

  const sortedBudgetNames = budgets.map((budget) => budget.name).sort();

  if (!sortedBudgetNames.includes('Misc')) {
    sortedBudgetNames.push('Misc');
    sortedBudgetNames.sort();
  }

  const fetchSuggestions = async (name: string) => {
    if (name.length < 2) {
      suggestions.value = [];
      showSuggestions.value = false;
      return;
    }

    try {
      const requestBody: SuggestionsRequestBody = {
        name,
      };

      const response = await fetch(`/api/expenses/auto-complete`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json() as SuggestionsResponse;
        suggestions.value = result.suggestions;
        showSuggestions.value = true;
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      suggestions.value = [];
      showSuggestions.value = false;
    }
  };

  return (
    <>
      <section
        class={`fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900 bg-opacity-60`}
      >
      </section>

      <section
        class={`fixed ${
          isOpen ? 'block' : 'hidden'
        } z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`}
      >
        <h1 class='text-2xl font-semibold my-5'>{expense ? 'Edit Expense' : 'Create New Expense'}</h1>
        <section class='py-5 my-2 border-y border-slate-500'>
          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='expense_cost'>Cost</label>
            <input
              class='input-field'
              type='text'
              name='expense_cost'
              id='expense_cost'
              value={newExpenseCost.value}
              onInput={(event) => {
                newExpenseCost.value = event.currentTarget.value;
              }}
              inputmode='decimal'
              placeholder='10.99'
            />
          </fieldset>

          <fieldset class='block mb-2 relative'>
            <label class='text-slate-300 block pb-1' for='expense_description'>Description</label>
            <input
              class='input-field'
              type='text'
              name='expense_description'
              id='expense_description'
              value={newExpenseDescription.value}
              onInput={(event) => {
                newExpenseDescription.value = event.currentTarget.value;
                fetchSuggestions(event.currentTarget.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onClickSave(
                    formatInputToNumber(newExpenseCost.value),
                    newExpenseDescription.value,
                    newExpenseBudget.value,
                    newExpenseDate.value,
                    newExpenseIsRecurring.value,
                  );
                }
              }}
              onFocus={() => {
                if (suggestions.value.length > 0) {
                  showSuggestions.value = true;
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  showSuggestions.value = false;
                }, 200);
              }}
              placeholder='Lunch'
            />
            {showSuggestions.value && suggestions.value.length > 0
              ? (
                <ul class='absolute z-50 w-full bg-slate-700 rounded-md mt-1 max-h-40 overflow-y-auto ring-1 ring-slate-800 shadow-lg'>
                  {suggestions.value.map((suggestion) => (
                    <li
                      key={suggestion}
                      class='px-4 py-2 hover:bg-slate-600 cursor-pointer'
                      onClick={() => {
                        newExpenseDescription.value = suggestion;
                        showSuggestions.value = false;
                        suggestions.value = [];
                      }}
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )
              : null}
          </fieldset>

          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='expense_budget'>Budget</label>
            <select
              class='input-field'
              name='expense_budget'
              id='expense_budget'
              value={newExpenseBudget.value}
              onChange={(event) => {
                newExpenseBudget.value = event.currentTarget.value;
              }}
            >
              {sortedBudgetNames.map((budget) => (
                <option value={budget} selected={newExpenseBudget.value === budget}>{budget}</option>
              ))}
            </select>
          </fieldset>

          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='expense_date'>Date</label>
            <input
              class='input-field'
              type='date'
              name='expense_date'
              id='expense_date'
              value={newExpenseDate.value}
              onInput={(event) => {
                newExpenseDate.value = event.currentTarget.value;
              }}
              placeholder='2025-01-01'
            />
          </fieldset>

          {expense
            ? (
              <fieldset class='block mb-2'>
                <label class='text-slate-300 block pb-1' for='expense_is_recurring'>Is Recurring?</label>
                <input
                  class='input-field'
                  type='checkbox'
                  name='expense_is_recurring'
                  id='expense_is_recurring'
                  value='true'
                  checked={newExpenseIsRecurring.value}
                  onInput={(event) => {
                    newExpenseIsRecurring.value = event.currentTarget.checked;
                  }}
                />
              </fieldset>
            )
            : null}
        </section>
        <footer class='flex justify-between'>
          {expense
            ? (
              <button
                class='px-5 py-2 bg-red-600 text-white cursor-pointer rounded-md mr-2 opacity-30 hover:opacity-100'
                onClick={() => onClickDelete()}
                type='button'
              >
                Delete
              </button>
            )
            : null}
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md mr-2'
            onClick={() => onClose()}
            type='button'
          >
            {expense ? 'Cancel' : 'Close'}
          </button>
          <button
            class='px-5 py-2 bg-slate-700 hover:bg-slate-500 text-white cursor-pointer rounded-md ml-2'
            onClick={() => {
              onClickSave(
                formatInputToNumber(newExpenseCost.value),
                newExpenseDescription.value,
                newExpenseBudget.value,
                newExpenseDate.value,
                newExpenseIsRecurring.value,
              );
            }}
            type='button'
          >
            {expense ? 'Update' : 'Create'}
          </button>
        </footer>
      </section>
    </>
  );
}
