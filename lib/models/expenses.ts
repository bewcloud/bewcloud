import Database, { sql } from '/lib/interfaces/database.ts';
import Locker from '/lib/interfaces/locker.ts';
import { Budget, Expense } from '/lib/types.ts';

const db = new Database();

export class BudgetModel {
  static async list(
    userId: string,
    month: string,
    { skipRecalculation = false }: { skipRecalculation?: boolean } = {},
  ) {
    if (!skipRecalculation) {
      await recalculateMonthBudgets(userId, month);
    }

    const budgets = await db.query<Budget>(
      sql`SELECT * FROM "bewcloud_budgets" WHERE "user_id" = $1 AND "month" = $2 ORDER BY cast("extra"->>'availableValue' as numeric) DESC, "value" DESC, "name" ASC`,
      [
        userId,
        month,
      ],
    );

    // Numeric values come as strings, so we need to convert them to numbers
    return budgets.map((budget) => ({
      ...budget,
      value: Number(budget.value),
    }));
  }

  static async getByName(userId: string, month: string, name: string) {
    const budget = (await db.query<Budget>(
      sql`SELECT * FROM "bewcloud_budgets" WHERE "user_id" = $1 AND "month" = $2 AND LOWER("name") = LOWER($3)`,
      [
        userId,
        month,
        name,
      ],
    ))[0];

    if (!budget) {
      return null;
    }

    // Numeric values come as strings, so we need to convert them to numbers
    return {
      ...budget,
      value: Number(budget.value),
    };
  }

  static async getById(userId: string, id: string) {
    const budget = (await db.query<Budget>(
      sql`SELECT * FROM "bewcloud_budgets" WHERE "user_id" = $1 AND "id" = $2`,
      [userId, id],
    ))[0];

    if (!budget) {
      return null;
    }

    // Numeric values come as strings, so we need to convert them to numbers
    return {
      ...budget,
      value: Number(budget.value),
    };
  }

  static async getAllForExport(
    userId: string,
  ): Promise<(Omit<Budget, 'id' | 'user_id' | 'created_at' | 'extra'> & { extra: Record<never, never> })[]> {
    const budgets = await db.query<Budget>(
      sql`SELECT * FROM "bewcloud_budgets" WHERE "user_id" = $1 ORDER BY "month" DESC, "name" ASC`,
      [
        userId,
      ],
    );

    return budgets.map((budget) => ({
      name: budget.name,
      month: budget.month,
      // Numeric values come as strings, so we need to convert them to numbers
      value: Number(budget.value),
      extra: {},
    }));
  }

  static async create(userId: string, name: string, month: string, value: number) {
    const extra: Budget['extra'] = {
      usedValue: 0,
      availableValue: value,
    };

    const newBudget = (await db.query<Budget>(
      sql`INSERT INTO "bewcloud_budgets" (
        "user_id",
        "name",
        "month",
        "value",
        "extra"
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        userId,
        name,
        month,
        value,
        JSON.stringify(extra),
      ],
    ))[0];

    // Numeric values come as strings, so we need to convert them to numbers
    return {
      ...newBudget,
      value: Number(newBudget.value),
    };
  }

  static async update(
    budget: Budget,
    { skipRecalculation = false }: { skipRecalculation?: boolean } = {},
  ) {
    await db.query(
      sql`UPDATE "bewcloud_budgets" SET
          "name" = $2,
          "month" = $3,
          "value" = $4,
          "extra" = $5
        WHERE "id" = $1`,
      [
        budget.id,
        budget.name,
        budget.month,
        budget.value,
        JSON.stringify(budget.extra),
      ],
    );

    if (!skipRecalculation) {
      await recalculateMonthBudgets(budget.user_id, budget.month);
    }
  }

  static async delete(userId: string, id: string) {
    await db.query(
      sql`DELETE FROM "bewcloud_budgets" WHERE "id" = $1 AND "user_id" = $2`,
      [
        id,
        userId,
      ],
    );
  }
}

export class ExpenseModel {
  static async list(userId: string, month: string) {
    const expenses = await db.query<Expense>(
      sql`SELECT * FROM "bewcloud_expenses" WHERE "user_id" = $1 AND "date" >= $2 AND "date" <= $3 ORDER BY "date" DESC, "created_at" DESC`,
      [
        userId,
        `${month}-01`,
        `${month}-31`,
      ],
    );

    // Numeric values come as strings, so we need to convert them to numbers
    return expenses.map((expense) => ({
      ...expense,
      cost: Number(expense.cost),
    }));
  }

  static async getByName(userId: string, name: string) {
    const expense = (await db.query<Expense>(
      sql`SELECT * FROM "bewcloud_expenses" WHERE "user_id" = $1 AND LOWER("description") = LOWER($2) ORDER BY "date" DESC, "created_at" DESC`,
      [
        userId,
        name,
      ],
    ))[0];

    if (!expense) {
      return null;
    }

    // Numeric values come as strings, so we need to convert them to numbers
    return {
      ...expense,
      cost: Number(expense.cost),
    };
  }

  static async listSuggestions(userId: string, name: string) {
    const expenses = await db.query<Pick<Expense, 'description'>>(
      sql`SELECT "description" FROM "bewcloud_expenses" WHERE "user_id" = $1 AND LOWER("description") ILIKE LOWER($2) GROUP BY "description" ORDER BY LENGTH("description") ASC, "description" ASC`,
      [
        userId,
        `%${name}%`,
      ],
    );

    return expenses.map((expense) => expense.description);
  }

  static async getAllForExport(
    userId: string,
  ): Promise<(Omit<Expense, 'id' | 'user_id' | 'created_at' | 'extra'> & { extra: Record<never, never> })[]> {
    const expenses = await db.query<Expense>(
      sql`SELECT * FROM "bewcloud_expenses" WHERE "user_id" = $1 ORDER BY "date" DESC, "created_at" DESC`,
      [
        userId,
      ],
    );

    return expenses.map((expense) => ({
      description: expense.description,
      budget: expense.budget,
      date: expense.date,
      is_recurring: expense.is_recurring,
      // Numeric values come as strings, so we need to convert them to numbers
      cost: Number(expense.cost),
      extra: {},
    }));
  }

  static async getById(userId: string, id: string) {
    const expense = (await db.query<Expense>(
      sql`SELECT * FROM "bewcloud_expenses" WHERE "user_id" = $1 AND "id" = $2`,
      [userId, id],
    ))[0];

    if (!expense) {
      return null;
    }

    // Numeric values come as strings, so we need to convert them to numbers
    return {
      ...expense,
      cost: Number(expense.cost),
    };
  }

  static async create(
    userId: string,
    cost: number,
    description: string,
    budget: string,
    date: string,
    is_recurring: boolean,
    { skipRecalculation = false, skipBudgetMatching = false, skipBudgetCreation = false }: {
      skipRecalculation?: boolean;
      skipBudgetMatching?: boolean;
      skipBudgetCreation?: boolean;
    } = {},
  ) {
    const extra: Expense['extra'] = {};

    if (!budget.trim()) {
      budget = 'Misc';
    }

    // Match budget to an existing expense "by default"
    if (!skipBudgetMatching && budget === 'Misc') {
      const existingExpense = await this.getByName(userId, description);

      if (existingExpense) {
        budget = existingExpense.budget;
      }
    }

    if (!skipBudgetCreation) {
      const existingBudgetInMonth = await BudgetModel.getByName(userId, date.substring(0, 7), budget);

      if (!existingBudgetInMonth) {
        await BudgetModel.create(userId, budget, date.substring(0, 7), 100);
      }
    }

    const newExpense = (await db.query<Expense>(
      sql`INSERT INTO "bewcloud_expenses" (
        "user_id",
        "cost",
        "description",
        "budget",
        "date",
        "is_recurring",
        "extra"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        userId,
        cost,
        description,
        budget,
        date,
        is_recurring,
        JSON.stringify(extra),
      ],
    ))[0];

    if (!skipRecalculation) {
      await recalculateMonthBudgets(userId, date.substring(0, 7));
    }

    // Numeric values come as strings, so we need to convert them to numbers
    return {
      ...newExpense,
      cost: Number(newExpense.cost),
    };
  }

  static async update(expense: Expense) {
    const existingBudgetInMonth = await BudgetModel.getByName(
      expense.user_id,
      expense.date.substring(0, 7),
      expense.budget,
    );

    if (!existingBudgetInMonth) {
      await BudgetModel.create(expense.user_id, expense.budget, expense.date.substring(0, 7), 100);
    }

    await db.query(
      sql`UPDATE "bewcloud_expenses" SET
          "cost" = $2,
          "description" = $3,
          "budget" = $4,
          "date" = $5,
          "is_recurring" = $6,
          "extra" = $7
        WHERE "id" = $1`,
      [
        expense.id,
        expense.cost,
        expense.description,
        expense.budget,
        expense.date,
        expense.is_recurring,
        JSON.stringify(expense.extra),
      ],
    );

    await recalculateMonthBudgets(expense.user_id, expense.date.substring(0, 7));
  }

  static async delete(userId: string, id: string) {
    const expense = await this.getById(userId, id);

    await db.query(
      sql`DELETE FROM "bewcloud_expenses" WHERE "id" = $1 AND "user_id" = $2`,
      [
        id,
        userId,
      ],
    );

    await recalculateMonthBudgets(userId, expense!.date.substring(0, 7));
  }
}

export async function deleteAllBudgetsAndExpenses(userId: string) {
  await db.query(
    sql`DELETE FROM "bewcloud_expenses" WHERE "user_id" = $1`,
    [
      userId,
    ],
  );

  await db.query(
    sql`DELETE FROM "bewcloud_budgets" WHERE "user_id" = $1`,
    [
      userId,
    ],
  );
}

export async function generateMonthlyBudgetsAndExpenses(userId: string, month: string) {
  const lock = new Locker(`expenses:${userId}:${month}`);

  await lock.acquire();

  let addedBudgetsCount = 0;
  let addedExpensesCount = 0;

  try {
    // Confirm there are no budgets or expenses for this month
    const monthBudgets = await BudgetModel.list(userId, month, { skipRecalculation: true });
    const monthExpenses = await ExpenseModel.list(userId, month);

    if (monthBudgets.length > 0 || monthExpenses.length > 0) {
      throw new Error('Budgets and expenses already exist for this month!');
    }

    // Get the previous month's budgets, to copy over
    const previousMonthDate = new Date(month);
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);

    const previousMonth = previousMonthDate.toISOString().substring(0, 7);

    const budgets = await BudgetModel.list(userId, previousMonth, { skipRecalculation: true });

    for (const budget of budgets) {
      await BudgetModel.create(userId, budget.name, month, budget.value);

      addedBudgetsCount++;
    }

    // Get the recurring expenses for the previous month, to copy over
    const recurringExpenses = (await ExpenseModel.list(userId, previousMonth)).filter((expense) =>
      expense.is_recurring
    );

    for (const expense of recurringExpenses) {
      await ExpenseModel.create(
        userId,
        expense.cost,
        expense.description,
        expense.budget,
        expense.date.replace(previousMonth, month),
        expense.is_recurring,
        { skipRecalculation: true },
      );

      addedExpensesCount++;
    }

    console.info(`Added ${addedBudgetsCount} new budgets and ${addedExpensesCount} new expenses for ${month}`);

    lock.release();
  } catch (error) {
    lock.release();

    throw error;
  }
}

export async function recalculateMonthBudgets(userId: string, month: string) {
  const lock = new Locker(`expenses:${userId}:${month}`);

  await lock.acquire();

  try {
    const budgets = await BudgetModel.list(userId, month, { skipRecalculation: true });
    const expenses = await ExpenseModel.list(userId, month);

    // Calculate total expenses for each budget
    const budgetExpenses = new Map<string, number>();
    for (const expense of expenses) {
      const currentTotal = Number(budgetExpenses.get(expense.budget) || 0);
      budgetExpenses.set(expense.budget, Number(currentTotal + expense.cost));
    }

    // Update each budget with new calculations
    for (const budget of budgets) {
      const usedValue = Number(budgetExpenses.get(budget.name) || 0);
      const availableValue = Number(budget.value - usedValue);

      const updatedBudget: Budget = {
        ...budget,
        extra: {
          ...budget.extra,
          usedValue,
          availableValue,
        },
      };

      if (budget.extra.usedValue !== usedValue || budget.extra.availableValue !== availableValue) {
        await BudgetModel.update(updatedBudget, { skipRecalculation: true });
      }
    }

    lock.release();
  } catch (error) {
    lock.release();

    throw error;
  }
}
