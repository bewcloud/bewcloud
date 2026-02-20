import { useSignal } from '@preact/signals';
import { useCallback, useEffect } from 'preact/hooks';
import ListBudgets from "/public/components/expenses/ListBudgets.js";
import ListExpenses from "/public/components/expenses/ListExpenses.js";
import ExpenseModal from "./ExpenseModal.js";
import BudgetModal from "./BudgetModal.js";
export default function MainExpenses({
  initialBudgets,
  initialExpenses,
  initialMonth,
  currency
}) {
  const isSaving = useSignal(false);
  const isImporting = useSignal(false);
  const isExporting = useSignal(false);
  const isSearching = useSignal(false);
  const budgets = useSignal(initialBudgets);
  const expenses = useSignal(initialExpenses);
  const currentMonth = useSignal(initialMonth);
  const areNewOptionsOption = useSignal(false);
  const isExpenseModalOpen = useSignal(false);
  const editingExpense = useSignal(null);
  const isBudgetModalOpen = useSignal(false);
  const editingBudget = useSignal(null);
  const shouldResetExpenseModal = useSignal(false);
  const shouldResetBudgetModal = useSignal(false);
  const searchTimeout = useSignal(0);
  const dateFormatOptions = {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC'
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
    fileInput.onchange = async event => {
      const chosenFilesList = event.target?.files;
      const chosenFiles = Array.from(chosenFilesList);
      isImporting.value = true;
      for (const chosenFile of chosenFiles) {
        if (!chosenFile) {
          continue;
        }
        areNewOptionsOption.value = false;
        let importedFileData = {};
        try {
          importedFileData = JSON.parse(await chosenFile.text());
        } catch (_error) {
          importedFileData = {};
        }
        if (!Object.prototype.hasOwnProperty.call(importedFileData, 'budgets') && !Object.prototype.hasOwnProperty.call(importedFileData, 'expenses')) {
          alert('Could not parse the file. Please confirm what you chose is correct.');
          return;
        }
        const budgetsToImport = importedFileData.budgets || [];
        const expensesToImport = importedFileData.expenses || [];
        const mergeOrReplace = prompt('Do you want to merge or replace the existing expenses and budgets? (merge/replace)');
        if (!mergeOrReplace || mergeOrReplace !== 'merge' && mergeOrReplace !== 'replace') {
          alert('Invalid input. Please enter "merge" or "replace".');
          return;
        }
        try {
          const requestBody = {
            budgets: budgetsToImport,
            expenses: expensesToImport,
            month: currentMonth.value,
            replace: mergeOrReplace === 'replace'
          };
          const response = await fetch(`/api/expenses/import-expenses`, {
            method: 'POST',
            body: JSON.stringify(requestBody)
          });
          if (!response.ok) {
            throw new Error(`Failed to import expenses and budgets! ${response.statusText} ${await response.text()}`);
          }
          const result = await response.json();
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
      const response = await fetch(`/api/expenses/export-expenses`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      if (!response.ok) {
        throw new Error(`Failed to export expenses. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to export expenses!');
      }
      const exportContents = JSON.stringify(result.jsonContents, null, 2);
      const jsonContent = `data:application/json; charset=utf-8,${encodeURIComponent(exportContents)}`;
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
  function onClickEditExpense(expenseId) {
    areNewOptionsOption.value = false;
    if (isExpenseModalOpen.value) {
      isExpenseModalOpen.value = false;
      return;
    }
    shouldResetExpenseModal.value = false;
    editingExpense.value = expenses.value.find(expense => expense.id === expenseId);
    isExpenseModalOpen.value = true;
  }
  function onClickEditBudget(budgetId) {
    areNewOptionsOption.value = false;
    if (isBudgetModalOpen.value) {
      isBudgetModalOpen.value = false;
      return;
    }
    if (budgetId === 'total') {
      return;
    }
    shouldResetBudgetModal.value = false;
    editingBudget.value = budgets.value.find(budget => budget.id === budgetId);
    isBudgetModalOpen.value = true;
  }
  async function onClickSaveExpense(newExpenseCost, newExpenseDescription, newExpenseBudget, newExpenseDate, newExpenseIsRecurring) {
    if (isSaving.value) {
      return;
    }
    if (!newExpenseCost || Number.isNaN(newExpenseCost) || !newExpenseDescription) {
      return;
    }
    areNewOptionsOption.value = false;
    isSaving.value = true;
    if (editingExpense.value) {
      const requestBody = {
        id: editingExpense.value.id,
        cost: newExpenseCost,
        description: newExpenseDescription,
        budget: newExpenseBudget,
        date: newExpenseDate,
        is_recurring: newExpenseIsRecurring,
        month: currentMonth.value
      };
      try {
        const response = await fetch(`/api/expenses/update-expense`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          throw new Error(`Failed to update expense! ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
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
      const requestBody = {
        cost: newExpenseCost,
        description: newExpenseDescription,
        budget: newExpenseBudget,
        date: newExpenseDate,
        is_recurring: newExpenseIsRecurring,
        month: currentMonth.value
      };
      try {
        const response = await fetch(`/api/expenses/add-expense`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          throw new Error(`Failed to add expense! ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
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
  async function onClickSaveBudget(newBudgetName, newBudgetMonth, newBudgetValue) {
    if (isSaving.value) {
      return;
    }
    if (!newBudgetName || !newBudgetMonth || !newBudgetMonth.match(/^\d{4}-\d{2}$/) || !newBudgetValue || Number.isNaN(newBudgetValue)) {
      return;
    }
    areNewOptionsOption.value = false;
    isSaving.value = true;
    if (editingBudget.value) {
      const requestBody = {
        id: editingBudget.value.id,
        name: newBudgetName,
        month: newBudgetMonth,
        value: newBudgetValue,
        currentMonth: currentMonth.value
      };
      try {
        const response = await fetch(`/api/expenses/update-budget`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          throw new Error(`Failed to update budget! ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
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
      const requestBody = {
        name: newBudgetName,
        month: newBudgetMonth,
        value: newBudgetValue,
        currentMonth: currentMonth.value
      };
      try {
        const response = await fetch(`/api/expenses/add-budget`, {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          throw new Error(`Failed to add budget! ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
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
    const requestBody = {
      id: editingExpense.value.id,
      month: currentMonth.value
    };
    try {
      const response = await fetch(`/api/expenses/delete-expense`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to delete expense! ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
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
    const requestBody = {
      id: editingBudget.value.id,
      currentMonth: currentMonth.value
    };
    try {
      const response = await fetch(`/api/expenses/delete-budget`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to delete budget! ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
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
  function onClickChangeMonth(changeTo) {
    const previousMonth = new Date(new Date(`${currentMonth.value}-15`).setUTCMonth(new Date(`${currentMonth.value}-15`).getUTCMonth() - 1)).toISOString().substring(0, 7);
    const nextMonth = new Date(new Date(`${currentMonth.value}-15`).setUTCMonth(new Date(`${currentMonth.value}-15`).getUTCMonth() + 1)).toISOString().substring(0, 7);
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
  function searchExpenses(searchTerm) {
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
        const filteredExpenses = initialExpenses.filter(expense => {
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
  return h(Fragment, null, h("section", {
    class: "block md:flex flex-row items-center justify-between mb-4"
  }, h("section", {
    class: "relative inline-block text-left ml-2 md:ml-0 mr-0 md:mr-2 mb-4 md:mb-0"
  }, h("section", {
    class: "flex flex-row items-center justify-start w-72"
  }, h("input", {
    class: "input-field mr-2",
    type: "search",
    name: "search",
    placeholder: "Filter expenses...",
    onInput: event => searchExpenses(event.currentTarget.value)
  }), isSearching.value ? h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }) : null)), h("section", {
    class: "flex items-center justify-end w-full"
  }, h("h3", {
    class: "text-base font-semibold text-white whitespace-nowrap mr-2"
  }, h("time", {
    datetime: `${currentMonth.value}-15`
  }, dateFormat.format(new Date(`${currentMonth.value}-15`)))), h("section", {
    class: "ml-2 relative flex items-center rounded-md bg-slate-700 shadow-sm md:items-stretch"
  }, h("button", {
    type: "button",
    class: "flex h-9 w-12 items-center justify-center rounded-l-md text-white hover:bg-slate-600 focus:relative",
    onClick: () => onClickChangeMonth('previous')
  }, h("span", {
    class: "sr-only"
  }, "Previous month"), h("svg", {
    class: "h-5 w-5",
    viewBox: "0 0 20 20",
    fill: "currentColor",
    "aria-hidden": "true"
  }, h("path", {
    "fill-rule": "evenodd",
    d: "M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z",
    "clip-rule": "evenodd"
  }))), h("button", {
    type: "button",
    class: "px-3.5 text-sm font-semibold text-white hover:bg-slate-600 focus:relative",
    onClick: () => onClickChangeMonth('today')
  }, "Today"), h("button", {
    type: "button",
    class: "flex h-9 w-12 items-center justify-center rounded-r-md text-white hover:bg-slate-600 pl-1 focus:relative",
    onClick: () => onClickChangeMonth('next')
  }, h("span", {
    class: "sr-only"
  }, "Next month"), h("svg", {
    class: "h-5 w-5",
    viewBox: "0 0 20 20",
    fill: "currentColor",
    "aria-hidden": "true"
  }, h("path", {
    "fill-rule": "evenodd",
    d: "M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z",
    "clip-rule": "evenodd"
  })))), h("section", {
    class: "relative inline-block text-left ml-2 mr-4 md:mr-0"
  }, h("div", null, h("button", {
    class: "inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2 min-w-10",
    type: "button",
    title: "Add new expense or budget",
    id: "new-button",
    "aria-expanded": "true",
    "aria-haspopup": "true",
    onClick: () => toggleNewOptionsDropdown()
  }, h("img", {
    src: "/public/images/add.svg",
    alt: "Add new expense or budget",
    class: `white ${isSaving.value || isImporting.value ? 'animate-spin' : ''}`,
    width: 20,
    height: 20
  }))), h("div", {
    class: `absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black ring-opacity-15 focus:outline-none ${!areNewOptionsOption.value ? 'hidden' : ''}`,
    role: "menu",
    "aria-orientation": "vertical",
    "aria-labelledby": "new-button",
    tabindex: -1
  }, h("div", {
    class: "py-1"
  }, h("button", {
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickCreateExpense(),
    type: "button"
  }, "New Expense"), h("button", {
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickCreateBudget(),
    type: "button"
  }, "New Budget"), h("section", {
    class: "flex items-center justify-center my-1"
  }, h("div", {
    class: "w-full border-t border-slate-600 mx-4"
  })), h("button", {
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickImportFile(),
    type: "button"
  }, "Import"), h("button", {
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickExportFile(),
    type: "button"
  }, "Export")))))), h("section", {
    class: "mx-auto max-w-7xl my-8"
  }, h(ListBudgets, {
    budgets: budgets.value,
    month: currentMonth.value,
    currency: currency,
    onClickEditBudget: onClickEditBudget
  }), h(ListExpenses, {
    expenses: expenses.value,
    currency: currency,
    onClickEditExpense: onClickEditExpense
  }), h("span", {
    class: `flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`
  }, isSaving.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Saving...") : null, isImporting.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Importing...") : null, isExporting.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Exporting...") : null, !isSaving.value && !isImporting.value && !isExporting.value ? h(Fragment, null, "\xA0") : null)), h(ExpenseModal, {
    isOpen: isExpenseModalOpen.value,
    expense: editingExpense.value,
    budgets: budgets.value,
    onClickSave: onClickSaveExpense,
    onClickDelete: onClickDeleteExpense,
    onClose: onCloseExpense,
    shouldResetForm: shouldResetExpenseModal.value
  }), h(BudgetModal, {
    isOpen: isBudgetModalOpen.value,
    budget: editingBudget.value,
    onClickSave: onClickSaveBudget,
    onClickDelete: onClickDeleteBudget,
    onClose: onCloseBudget,
    shouldResetForm: shouldResetBudgetModal.value
  }));
}