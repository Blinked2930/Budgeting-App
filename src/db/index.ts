import Dexie, { type Table } from 'dexie';
import type { BudgetCycle, ExpenseRecord } from '../types';
import { convertToALL } from '../utils/currency';
import { exportToCSV as generateCSV, exportToJSON as generateJSON } from '../utils/export';

export class LekFlowDatabase extends Dexie {
  expenses!: Table<ExpenseRecord, string>;
  budgetCycles!: Table<BudgetCycle, string>;

  constructor() {
    super('LekFlowDB');
    this.version(1).stores({
      expenses: 'id, timestamp, category, vendorType, isSynced, amountInALL',
      budgetCycles: 'id, startDate, targetEndDate',
    });
  }
}

export const db = new LekFlowDatabase();

/**
 * Add a new expense record locally to Dexie.
 * Generates UUID, timestamps in ISO format, calculates amountInALL, and sets isSynced: false.
 */
export async function addExpense(
  expenseData: Omit<ExpenseRecord, 'id' | 'timestamp' | 'isSynced' | 'amountInALL'> & {
    id?: string;
    timestamp?: string;
    isSynced?: boolean;
    amountInALL?: number;
  }
): Promise<ExpenseRecord> {
  const now = new Date().toISOString();
  const id = expenseData.id || crypto.randomUUID();
  const amountInALL =
    expenseData.amountInALL !== undefined
      ? expenseData.amountInALL
      : convertToALL(expenseData.amount, expenseData.currency);

  const record: ExpenseRecord = {
    ...expenseData,
    id,
    amountInALL,
    timestamp: expenseData.timestamp || now,
    isSynced: expenseData.isSynced ?? false,
    updatedAt: now,
  };

  await db.expenses.add(record);
  return record;
}

/**
 * Retrieve all expenses, ordered by latest first.
 */
export async function getExpenses(limit?: number): Promise<ExpenseRecord[]> {
  const query = db.expenses.orderBy('timestamp').reverse();
  if (limit) {
    return query.limit(limit).toArray();
  }
  return query.toArray();
}

/**
 * Delete an expense by ID.
 */
export async function deleteExpense(id: string): Promise<void> {
  await db.expenses.delete(id);
}

/**
 * Update an existing expense record.
 */
export async function updateExpense(
  id: string,
  updates: Partial<Omit<ExpenseRecord, 'id'>>
): Promise<void> {
  const existing = await db.expenses.get(id);
  if (!existing) return;

  const amount = updates.amount ?? existing.amount;
  const currency = updates.currency ?? existing.currency;
  const amountInALL =
    updates.amountInALL ??
    (updates.amount !== undefined || updates.currency !== undefined
      ? convertToALL(amount, currency)
      : existing.amountInALL);

  await db.expenses.update(id, {
    ...updates,
    amountInALL,
    updatedAt: new Date().toISOString(),
    isSynced: false,
  });
}

/**
 * Get all un-synced expenses for remote synchronization.
 */
export async function getUnsyncedExpenses(): Promise<ExpenseRecord[]> {
  return db.expenses.filter((e) => !e.isSynced).toArray();
}

/**
 * Mark expenses as synced once backend confirms commit.
 */
export async function markExpensesAsSynced(ids: string[]): Promise<void> {
  await db.transaction('rw', db.expenses, async () => {
    for (const id of ids) {
      await db.expenses.update(id, { isSynced: true });
    }
  });
}

/**
 * Get distinct historical item names for interactive auto-suggestions.
 */
export async function getHistoricalItemNames(): Promise<string[]> {
  const items = await db.expenses
    .filter((e) => Boolean(e.itemName && e.itemName.trim().length > 0))
    .toArray();

  const namesSet = new Set<string>();
  for (const item of items) {
    if (item.itemName) {
      namesSet.add(item.itemName.trim());
    }
  }
  return Array.from(namesSet);
}

/**
 * Export all local expenses to CSV format string.
 */
export async function exportToCSV(): Promise<string> {
  const expenses = await getExpenses();
  return generateCSV(expenses);
}

/**
 * Export all local expenses to JSON format string.
 */
export async function exportToJSON(): Promise<string> {
  const expenses = await getExpenses();
  return generateJSON(expenses);
}

/**
 * Add or update budget cycle.
 */
export async function saveBudgetCycle(cycle: BudgetCycle): Promise<void> {
  await db.budgetCycles.put(cycle);
}

/**
 * Get current or most recent budget cycle.
 */
export async function getCurrentBudgetCycle(): Promise<BudgetCycle | undefined> {
  return db.budgetCycles.orderBy('startDate').reverse().first();
}
