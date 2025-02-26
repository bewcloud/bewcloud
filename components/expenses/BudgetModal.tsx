import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { Budget } from '/lib/types.ts';

interface BudgetModalProps {
  isOpen: boolean;
  budget: Budget | null;
  onClickSave: (newBudgetName: string, newBudgetMonth: string, newBudgetValue: number) => Promise<void>;
  onClickDelete: () => Promise<void>;
  onClose: () => void;
}

export default function BudgetModal(
  { isOpen, budget, onClickSave, onClickDelete, onClose }: BudgetModalProps,
) {
  const newBudgetName = useSignal<string>(budget?.name ?? '');
  const newBudgetMonth = useSignal<string>(budget?.month ?? new Date().toISOString().substring(0, 10));
  const newBudgetValue = useSignal<number>(budget?.value ?? 100);

  useEffect(() => {
    if (budget) {
      newBudgetName.value = budget.name;
      newBudgetMonth.value = `${budget.month}-15`;
      newBudgetValue.value = budget.value;
    } else {
      newBudgetName.value = '';
      newBudgetMonth.value = new Date().toISOString().substring(0, 10);
      newBudgetValue.value = 100;
    }
  }, [budget]);

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
        <h1 class='text-2xl font-semibold my-5'>{budget ? 'Edit Budget' : 'Create New Budget'}</h1>
        <section class='py-5 my-2 border-y border-slate-500'>
          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='budget_name'>Name</label>
            <input
              class='input-field'
              type='text'
              name='budget_name'
              id='budget_name'
              value={newBudgetName.value}
              onInput={(event) => {
                newBudgetName.value = event.currentTarget.value;
              }}
              placeholder='Amazing'
            />
          </fieldset>

          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='budget_month'>Month</label>
            <input
              class='input-field'
              type='date'
              name='budget_month'
              id='budget_month'
              value={newBudgetMonth.value}
              onInput={(event) => {
                newBudgetMonth.value = event.currentTarget.value;
              }}
              placeholder='2025-01-01'
            />
          </fieldset>

          <fieldset class='block mb-2'>
            <label class='text-slate-300 block pb-1' for='budget_value'>Value</label>
            <input
              class='input-field'
              type='text'
              name='budget_value'
              id='budget_value'
              value={newBudgetValue.value}
              onInput={(event) => {
                newBudgetValue.value = Number(event.currentTarget.value);
              }}
              placeholder='100'
            />
          </fieldset>
        </section>
        <footer class='flex justify-between'>
          {budget
            ? (
              <button
                class='px-5 py-2 bg-slate-600 hover:bg-red-600 text-white cursor-pointer rounded-md mr-2'
                onClick={() => onClickDelete()}
              >
                Delete
              </button>
            )
            : null}
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md mr-2'
            onClick={() => onClickSave(newBudgetName.value, newBudgetMonth.value.substring(0, 7), newBudgetValue.value)}
          >
            {budget ? 'Update' : 'Create'}
          </button>
          <button
            class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md ml-2'
            onClick={() => onClose()}
          >
            {budget ? 'Cancel' : 'Close'}
          </button>
        </footer>
      </section>
    </>
  );
}
