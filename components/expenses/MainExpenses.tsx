import { useSignal } from '@preact/signals';
import { useCallback, useEffect } from 'preact/hooks';

import { Budget, Expense, SupportedCurrencySymbol } from '/lib/types.ts';
import {
  RequestBody as ImportRequestBody,
  ResponseBody as ImportResponseBody,
} from '/routes/api/expenses/import-expenses.tsx';
import {
  RequestBody as ExportRequestBody,
  ResponseBody as ExportResponseBody,
} from '/routes/api/expenses/export-expenses.tsx';
import {
  RequestBody as AddExpenseRequestBody,
  ResponseBody as AddExpenseResponseBody,
} from '/routes/api/expenses/add-expense.tsx';
import {
  RequestBody as AddBudgetRequestBody,
  ResponseBody as AddBudgetResponseBody,
} from '/routes/api/expenses/add-budget.tsx';
import {
  RequestBody as UpdateExpenseRequestBody,
  ResponseBody as UpdateExpenseResponseBody,
} from '/routes/api/expenses/update-expense.tsx';
import {
  RequestBody as UpdateBudgetRequestBody,
  ResponseBody as UpdateBudgetResponseBody,
} from '/routes/api/expenses/update-budget.tsx';
import {
  RequestBody as DeleteExpenseRequestBody,
  ResponseBody as DeleteExpenseResponseBody,
} from '/routes/api/expenses/delete-expense.tsx';
import {
  RequestBody as DeleteBudgetRequestBody,
  ResponseBody as DeleteBudgetResponseBody,
} from '/routes/api/expenses/delete-budget.tsx';
import ListBudgets from '/components/expenses/ListBudgets.tsx';
import ListExpenses from '/components/expenses/ListExpenses.tsx';
import ExpenseModal from './ExpenseModal.tsx';
import BudgetModal from './BudgetModal.tsx';

interface MainExpensesProps {
  initialBudgets: Budget[];
  initialExpenses: Expense[];
  initialMonth: string;
  currency: SupportedCurrencySymbol;
}

export default function MainExpenses({ initialBudgets, initialExpenses, initialMonth, currency }: MainExpensesProps) {
  const isSaving = useSignal<boolean>(false);
  const isImporting = useSignal<boolean>(false);
  const isExporting = useSignal<boolean>(false);
  const isSearching = useSignal<boolean>(false);
  const budgets = useSignal<Budget[]>(initialBudgets);
  const expenses = useSignal<Expense[]>(initialExpenses);
  const currentMonth = useSignal<string>(initialMonth);
  const areNewOptionsOption = useSignal<boolean>(false);
  const isExpenseModalOpen = useSignal<boolean>(false);
  const editingExpense = useSignal<Expense | null>(null);
  const isBudgetModalOpen = useSignal<boolean>(false);
  const editingBudget = useSignal<Budget | null>(null);
  const shouldResetExpenseModal = useSignal<boolean>(false);
  const shouldResetBudgetModal = useSignal<boolean>(false);
  const searchTimeout = useSignal<ReturnType<typeof setTimeout>>(0);

  const dateFormatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC', // Expense dates are stored without timezone info, so we need to force to UTC so it's consistent across db, server, and client
  };

  const dateFormat = new Intl.DateTimeFormat('en-GB', dateFormatOptions);

  const thisMonth = new Date().toISOString().substring(0, 7);

  function onClickImportFile() {
    areNewOptionsOption.value = false;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'text/pain,application/json,.json';
    fileInput.ariaLabel = 'Import your budgets and expenses';
    fileInput.click();

    fileInput.onchange = async (event) => {
      const chosenFilesList = (event.target as HTMLInputElement)?.files!;

      const chosenFiles = Array.from(chosenFilesList);

      isImporting.value = true;

      for (const chosenFile of chosenFiles) {
        if (!chosenFile) {
          continue;
        }

        areNewOptionsOption.value = false;

        let importedFileData: { budgets?: ImportRequestBody['budgets']; expenses?: ImportRequestBody['expenses'] } = {};

        try {
          importedFileData = JSON.parse(await chosenFile.text());
        } catch (_error) {
          importedFileData = {};
        }

        if (
          !Object.prototype.hasOwnProperty.call(importedFileData, 'budgets') &&
          !Object.prototype.hasOwnProperty.call(importedFileData, 'expenses')
        ) {
          alert('Could not parse the file. Please confirm what you chose is correct.');
          return;
        }

        const budgetsToImport = importedFileData.budgets || [];
        const expensesToImport = importedFileData.expenses || [];

        const mergeOrReplace = prompt(
          'Do you want to merge or replace the existing expenses and budgets? (merge/replace)',
        );

        if (!mergeOrReplace || (mergeOrReplace !== 'merge' && mergeOrReplace !== 'replace')) {
          alert('Invalid input. Please enter "merge" or "replace".');
          return;
        }

        try {
          const requestBody: ImportRequestBody = {
            budgets: budgetsToImport,
            expenses: expensesToImport,
            month: currentMonth.value,
            replace: mergeOrReplace === 'replace',
          };
          const response = await fetch(`/api/expenses/import-expenses`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            throw new Error(`Failed to import expenses and budgets! ${response.statusText} ${await response.text()}`);
          }

          const result = await response.json() as ImportResponseBody;

          if (!result.success) {
            throw new Error('Failed to import expenses and budgets!');
          }

          budgets.value = [...result.newBudgets];
          expenses.value = [...result.newExpenses];
        } catch (error) {
          console.error(error);
          alert(error);
        }
      }

      isImporting.value = false;
    };
  }

  async function onClickExportFile() {
    areNewOptionsOption.value = false;

    isExporting.value = true;

    const fileName = `expenses-data-export-${new Date().toISOString().substring(0, 19).replace(/:/g, '-')}.json`;

    try {
      const requestBody: ExportRequestBody = {};
      const response = await fetch(`/api/expenses/export-expenses`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to export expenses. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as ExportResponseBody;

      if (!result.success) {
        throw new Error('Failed to export expenses!');
      }

      const exportContents = JSON.stringify(result.jsonContents, null, 2);

      // Add content-type
      const jsonContent = `data:application/json; charset=utf-8,${encodeURIComponent(exportContents)}`;

      // Download the file
      const data = jsonContent;
      const link = document.createElement('a');
      link.setAttribute('href', data);
      link.setAttribute('download', fileName);
      link.click();
      link.remove();
    } catch (error) {
      console.error(error);
      alert(error);
    }

    isExporting.value = false;
  }

  function onClickCreateExpense() {
    areNewOptionsOption.value = false;

    if (isExpenseModalOpen.value) {
      isExpenseModalOpen.value = false;
      return;
    }

    shouldResetExpenseModal.value = false;
    editingExpense.value = null;
    isExpenseModalOpen.value = true;
  }

  function onClickCreateBudget() {
    areNewOptionsOption.value = false;

    if (isBudgetModalOpen.value) {
      isBudgetModalOpen.value = false;
      return;
    }

    shouldResetBudgetModal.value = false;
    editingBudget.value = null;
    isBudgetModalOpen.value = true;
  }

  function onClickEditExpense(expenseId: string) {
    areNewOptionsOption.value = false;

    if (isExpenseModalOpen.value) {
      isExpenseModalOpen.value = false;
      return;
    }

    shouldResetExpenseModal.value = false;
    editingExpense.value = expenses.value.find((expense) => expense.id === expenseId)!;
    isExpenseModalOpen.value = true;
  }

  function onClickEditBudget(budgetId: string) {
    areNewOptionsOption.value = false;

    if (isBudgetModalOpen.value) {
      isBudgetModalOpen.value = false;
      return;
    }

    // Can't edit the total budget
    if (budgetId === 'total') {
      return;
    }

    shouldResetBudgetModal.value = false;
    editingBudget.value = budgets.value.find((budget) => budget.id === budgetId)!;
    isBudgetModalOpen.value = true;
  }

  async function onClickSaveExpense(
    newExpenseCost: number,
    newExpenseDescription: string,
    newExpenseBudget: string,
    newExpenseDate: string,
    newExpenseIsRecurring: boolean,
  ) {
    if (isSaving.value) {
      return;
    }

    if (!newExpenseCost || Number.isNaN(newExpenseCost) || !newExpenseDescription) {
      return;
    }

    areNewOptionsOption.value = false;
    isSaving.value = true;

    if (editingExpense.value) {
      const requestBody: UpdateExpenseRequestBody = {
        id: editingExpense.value.id,
        cost: newExpenseCost,
        description: newExpenseDescription,
        budget: newExpenseBudget,
        date: newExpenseDate,
        is_recurring: newExpenseIsRecurring,
        month: currentMonth.value,
      };

      try {
        const response = await fetch(`/api/expenses/update-expense`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Failed to update expense! ${response.statusText} ${await response.text()}`);
        }

        const result = await response.json() as UpdateExpenseResponseBody;

        if (!result.success) {
          throw new Error('Failed to update expense!');
        }

        expenses.value = [...result.newExpenses];
        budgets.value = [...result.newBudgets];

        isExpenseModalOpen.value = false;
        editingExpense.value = null;
        shouldResetExpenseModal.value = true;
      } catch (error) {
        console.error(error);
        alert(error);
      }
    } else {
      const requestBody: AddExpenseRequestBody = {
        cost: newExpenseCost,
        description: newExpenseDescription,
        budget: newExpenseBudget,
        date: newExpenseDate,
        is_recurring: newExpenseIsRecurring,
        month: currentMonth.value,
      };

      try {
        const response = await fetch(`/api/expenses/add-expense`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Failed to add expense! ${response.statusText} ${await response.text()}`);
        }

        const result = await response.json() as AddExpenseResponseBody;

        if (!result.success) {
          throw new Error('Failed to add expense!');
        }

        expenses.value = [...result.newExpenses];
        budgets.value = [...result.newBudgets];

        isExpenseModalOpen.value = false;
        shouldResetExpenseModal.value = true;
      } catch (error) {
        console.error(error);
        alert(error);
      }
    }

    isSaving.value = false;
  }

  async function onClickSaveBudget(newBudgetName: string, newBudgetMonth: string, newBudgetValue: number) {
    if (isSaving.value) {
      return;
    }

    if (
      !newBudgetName || !newBudgetMonth || !newBudgetMonth.match(/^\d{4}-\d{2}$/) || !newBudgetValue ||
      Number.isNaN(newBudgetValue)
    ) {
      return;
    }

    areNewOptionsOption.value = false;
    isSaving.value = true;

    if (editingBudget.value) {
      const requestBody: UpdateBudgetRequestBody = {
        id: editingBudget.value.id,
        name: newBudgetName,
        month: newBudgetMonth,
        value: newBudgetValue,
        currentMonth: currentMonth.value,
      };

      try {
        const response = await fetch(`/api/expenses/update-budget`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Failed to update budget! ${response.statusText} ${await response.text()}`);
        }

        const result = await response.json() as UpdateBudgetResponseBody;

        if (!result.success) {
          throw new Error('Failed to update budget!');
        }

        budgets.value = [...result.newBudgets];

        isBudgetModalOpen.value = false;
        editingBudget.value = null;
        shouldResetBudgetModal.value = true;
      } catch (error) {
        console.error(error);
        alert(error);
      }
    } else {
      const requestBody: AddBudgetRequestBody = {
        name: newBudgetName,
        month: newBudgetMonth,
        value: newBudgetValue,
        currentMonth: currentMonth.value,
      };

      try {
        const response = await fetch(`/api/expenses/add-budget`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Failed to add budget! ${response.statusText} ${await response.text()}`);
        }

        const result = await response.json() as AddBudgetResponseBody;

        if (!result.success) {
          throw new Error('Failed to add budget!');
        }

        budgets.value = [...result.newBudgets];

        isBudgetModalOpen.value = false;
        shouldResetBudgetModal.value = true;
      } catch (error) {
        console.error(error);
        alert(error);
      }
    }

    isSaving.value = false;
  }

  async function onClickDeleteExpense() {
    if (isSaving.value) {
      return;
    }

    if (!editingExpense.value) {
      return;
    }

    if (!confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    isSaving.value = true;

    const requestBody: DeleteExpenseRequestBody = {
      id: editingExpense.value.id,
      month: currentMonth.value,
    };

    try {
      const response = await fetch(`/api/expenses/delete-expense`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete expense! ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as DeleteExpenseResponseBody;

      if (!result.success) {
        throw new Error('Failed to delete expense!');
      }

      expenses.value = [...result.newExpenses];
      budgets.value = [...result.newBudgets];

      isExpenseModalOpen.value = false;
      editingExpense.value = null;
      shouldResetExpenseModal.value = true;
    } catch (error) {
      console.error(error);
      alert(error);
    }

    isSaving.value = false;
  }

  async function onClickDeleteBudget() {
    if (isSaving.value) {
      return;
    }

    if (!editingBudget.value) {
      return;
    }

    if (!confirm('Are you sure you want to delete this budget?')) {
      return;
    }

    isSaving.value = true;

    const requestBody: DeleteBudgetRequestBody = {
      id: editingBudget.value.id,
      currentMonth: currentMonth.value,
    };

    try {
      const response = await fetch(`/api/expenses/delete-budget`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete budget! ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as DeleteBudgetResponseBody;

      if (!result.success) {
        throw new Error('Failed to delete budget!');
      }

      budgets.value = [...result.newBudgets];

      isBudgetModalOpen.value = false;
      editingBudget.value = null;
      shouldResetBudgetModal.value = true;
    } catch (error) {
      console.error(error);
      alert(error);
    }

    isSaving.value = false;
  }

  function onCloseExpense() {
    isExpenseModalOpen.value = false;
    editingExpense.value = null;
    shouldResetExpenseModal.value = true;
  }

  function onCloseBudget() {
    isBudgetModalOpen.value = false;
    editingBudget.value = null;
    shouldResetBudgetModal.value = true;
  }

  function toggleNewOptionsDropdown() {
    areNewOptionsOption.value = !areNewOptionsOption.value;
  }

  function onClickChangeMonth(changeTo: 'previous' | 'next' | 'today') {
    const previousMonth = new Date(
      new Date(`${currentMonth.value}-15`).setUTCMonth(new Date(`${currentMonth.value}-15`).getUTCMonth() - 1),
    ).toISOString()
      .substring(0, 7);
    const nextMonth = new Date(
      new Date(`${currentMonth.value}-15`).setUTCMonth(new Date(`${currentMonth.value}-15`).getUTCMonth() + 1),
    ).toISOString()
      .substring(0, 7);

    if (changeTo === 'today') {
      if (thisMonth === currentMonth.value) {
        return;
      }

      window.location.href = `/expenses?month=${thisMonth}`;
      return;
    }

    if (changeTo === 'previous') {
      const newStartDate = previousMonth;

      if (newStartDate === currentMonth.value) {
        return;
      }

      window.location.href = `/expenses?month=${newStartDate}`;
      return;
    }

    const newStartDate = nextMonth;

    if (newStartDate === currentMonth.value) {
      return;
    }

    window.location.href = `/expenses?month=${newStartDate}`;
  }

  function searchExpenses(searchTerm: string) {
    if (searchTimeout.value) {
      clearTimeout(searchTimeout.value);
    }

    if (searchTerm.trim().length < 2) {
      expenses.value = initialExpenses;
      return;
    }

    searchTimeout.value = setTimeout(() => {
      isSearching.value = true;

      try {
        const normalizedSearchTerm = searchTerm.trim().normalize().toLowerCase();
        const filteredExpenses = initialExpenses.filter((expense) => {
          const descriptionMatch = expense.description.toLowerCase().includes(normalizedSearchTerm);
          const budgetMatch = expense.budget.toLowerCase().includes(normalizedSearchTerm);
          return descriptionMatch || budgetMatch;
        });

        expenses.value = filteredExpenses;
      } catch (error) {
        console.error(error);
        alert(error);
        expenses.value = initialExpenses;
      }

      isSearching.value = false;
    }, 500);
  }

  // Open the expense modal if the window is small
  const handleWindowResize = useCallback(() => {
    if (globalThis.innerWidth < 600 && !isExpenseModalOpen.value && !editingExpense.value) {
      isExpenseModalOpen.value = true;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
      }
    };
  }, []);

  useEffect(() => {
    handleWindowResize();
    globalThis.addEventListener('resize', handleWindowResize);

    return () => {
      globalThis.removeEventListener('resize', handleWindowResize);
    };
  }, [handleWindowResize]);

  return (
    <>
      <section class='block md:flex flex-row items-center justify-between mb-4'>
        <section class='relative inline-block text-left ml-2 md:ml-0 mr-0 md:mr-2 mb-4 md:mb-0'>
          <section class='flex flex-row items-center justify-start w-72'>
            <input
              class='input-field mr-2'
              type='search'
              name='search'
              placeholder='Filter expenses...'
              onInput={(event) => searchExpenses(event.currentTarget.value)}
            />
            {isSearching.value ? <img src='/images/loading.svg' class='white mr-2' width={18} height={18} /> : null}
          </section>
        </section>
        <section class='flex items-center justify-end w-full'>
          <h3 class='text-base font-semibold text-white whitespace-nowrap mr-2'>
            <time datetime={`${currentMonth.value}-15`}>{dateFormat.format(new Date(`${currentMonth.value}-15`))}</time>
          </h3>
          <section class='ml-2 relative flex items-center rounded-md bg-slate-700 shadow-sm md:items-stretch'>
            <button
              type='button'
              class='flex h-9 w-12 items-center justify-center rounded-l-md text-white hover:bg-slate-600 focus:relative'
              onClick={() => onClickChangeMonth('previous')}
            >
              <span class='sr-only'>Previous month</span>
              <svg class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                <path
                  fill-rule='evenodd'
                  d='M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z'
                  clip-rule='evenodd'
                />
              </svg>
            </button>
            <button
              type='button'
              class='px-3.5 text-sm font-semibold text-white hover:bg-slate-600 focus:relative'
              onClick={() => onClickChangeMonth('today')}
            >
              Today
            </button>
            <button
              type='button'
              class='flex h-9 w-12 items-center justify-center rounded-r-md text-white hover:bg-slate-600 pl-1 focus:relative'
              onClick={() => onClickChangeMonth('next')}
            >
              <span class='sr-only'>Next month</span>
              <svg class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                <path
                  fill-rule='evenodd'
                  d='M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z'
                  clip-rule='evenodd'
                />
              </svg>
            </button>
          </section>
          <section class='relative inline-block text-left ml-2 mr-4 md:mr-0'>
            <div>
              <button
                class='inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2 min-w-10'
                type='button'
                title='Add new expense or budget'
                id='new-button'
                aria-expanded='true'
                aria-haspopup='true'
                onClick={() => toggleNewOptionsDropdown()}
              >
                <img
                  src='/images/add.svg'
                  alt='Add new expense or budget'
                  class={`white ${isSaving.value || isImporting.value ? 'animate-spin' : ''}`}
                  width={20}
                  height={20}
                />
              </button>
            </div>

            <div
              class={`absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${
                !areNewOptionsOption.value ? 'hidden' : ''
              }`}
              role='menu'
              aria-orientation='vertical'
              aria-labelledby='new-button'
              tabindex={-1}
            >
              <div class='py-1'>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickCreateExpense()}
                  type='button'
                >
                  New Expense
                </button>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickCreateBudget()}
                  type='button'
                >
                  New Budget
                </button>

                <section class='flex items-center justify-center my-1'>
                  <div class='w-full border-t border-slate-600 mx-4' />
                </section>

                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickImportFile()}
                  type='button'
                >
                  Import
                </button>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickExportFile()}
                  type='button'
                >
                  Export
                </button>
              </div>
            </div>
          </section>
        </section>
      </section>

      <section class='mx-auto max-w-7xl my-8'>
        <ListBudgets
          budgets={budgets.value}
          month={currentMonth.value}
          currency={currency}
          onClickEditBudget={onClickEditBudget}
        />

        <ListExpenses
          expenses={expenses.value}
          currency={currency}
          onClickEditExpense={onClickEditExpense}
        />

        <span
          class={`flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`}
        >
          {isSaving.value
            ? (
              <>
                <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Saving...
              </>
            )
            : null}
          {isImporting.value
            ? (
              <>
                <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Importing...
              </>
            )
            : null}
          {isExporting.value
            ? (
              <>
                <img src='/images/loading.svg' class='white mr-2' width={18} height={18} />Exporting...
              </>
            )
            : null}
          {!isSaving.value && !isImporting.value && !isExporting.value ? <>&nbsp;</> : null}
        </span>
      </section>

      <ExpenseModal
        isOpen={isExpenseModalOpen.value}
        expense={editingExpense.value}
        budgets={budgets.value}
        onClickSave={onClickSaveExpense}
        onClickDelete={onClickDeleteExpense}
        onClose={onCloseExpense}
        shouldResetForm={shouldResetExpenseModal.value}
      />

      <BudgetModal
        isOpen={isBudgetModalOpen.value}
        budget={editingBudget.value}
        onClickSave={onClickSaveBudget}
        onClickDelete={onClickDeleteBudget}
        onClose={onCloseBudget}
        shouldResetForm={shouldResetBudgetModal.value}
      />
    </>
  );
}
