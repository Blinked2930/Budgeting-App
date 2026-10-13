// src/db/index.ts
import Dexie, { type Table } from 'dexie';
import type {
  BudgetCycle,
  Category,
  Currency,
  ExpenseRecord,
  FoodType,
  PaymentSource,
  TransferDirection,
  TransferRecord,
  VendorType,
} from '../types';
import { convertToALL } from '../utils/currency';
import { exportToCSV as generateCSV, exportToJSON as generateJSON } from '../utils/export';

export class LekFlowDatabase extends Dexie {
  expenses!: Table<ExpenseRecord, string>;
  budgetCycles!: Table<BudgetCycle, string>;
  transfers!: Table<TransferRecord, string>;

  constructor() {
    super('LekFlowDB');
    this.version(1).stores({
      expenses: 'id, timestamp, category, vendorType, isSynced, amountInALL',
      budgetCycles: 'id, startDate, targetEndDate',
    });
    this.version(2).stores({
      expenses: 'id, timestamp, category, vendorType, isSynced, amountInALL',
      budgetCycles: 'id, startDate, targetEndDate, isSynced, updatedAt',
    });
    // v3 adds the transfers table and paidWith on expenses (no index change needed).
    this.version(3).stores({
      expenses: 'id, timestamp, category, vendorType, isSynced, amountInALL',
      budgetCycles: 'id, startDate, targetEndDate, isSynced, updatedAt',
      transfers: 'id, timestamp, isSynced, updatedAt',
    });
  }
}

export const db = new LekFlowDatabase();

export interface RemoteExpense {
  _id?: string;
  localId: string;
  amount: number;
  currency: Currency;
  amountInALL: number;
  category: string;
  subcategory?: string;
  vendorType?: string;
  foodType?: string;
  itemName?: string;
  estimatedMeals?: number;
  paidWith?: string;
  timestamp: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface RemoteBudgetCycle {
  _id?: string;
  localId: string;
  startDate: string;
  targetEndDate: string;
  stipendAmountALL: number;
  startingRaiffeisenBalanceALL: number;
  startingCashALL?: number;
  bufferPoolALL: number;
  travelStashALL: number;
  updatedAt?: string;
  deleted?: boolean;
}

export interface RemoteTransfer {
  _id?: string;
  localId: string;
  amountALL: number;
  direction: string;
  timestamp: string;
  updatedAt?: string;
  deleted?: boolean;
}

// ---------- Expense helpers ----------

export async function addExpense(
  expenseData: Omit<ExpenseRecord, 'id' | 'timestamp' | 'isSynced' | 'amountInALL'> & {
    id?: string;
    timestamp?: string;
    isSynced?: boolean;
    amountInALL?: number;
    subcategory?: string;
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
    subcategory: expenseData.subcategory,
    timestamp: expenseData.timestamp || now,
    isSynced: expenseData.isSynced ?? false,
    updatedAt: now,
  };

  await db.expenses.add(record);
  return record;
}

export async function getExpenses(limit?: number): Promise<ExpenseRecord[]> {
  const query = db.expenses
    .orderBy('timestamp')
    .reverse()
    .filter((e) => !e.deleted);
  if (limit) {
    return query.limit(limit).toArray();
  }
  return query.toArray();
}

export async function deleteExpense(id: string): Promise<void> {
  await db.expenses.update(id, {
    deleted: true,
    isSynced: false,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateExpense(
  id: string,
  updates: Partial<Omit<ExpenseRecord, 'id'>>
): Promise<void> {
  const existing = await db.expenses.get(id);
  if (!existing || existing.deleted) return;

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

export async function getUnsyncedExpenses(): Promise<ExpenseRecord[]> {
  return db.expenses.filter((e) => !e.isSynced).toArray();
}

export async function markExpensesAsSynced(ids: string[]): Promise<void> {
  await db.transaction('rw', db.expenses, async () => {
    for (const id of ids) {
      await db.expenses.update(id, { isSynced: true });
    }
  });
}

export async function markSyncedIfUnchanged(
  entries: { id: string; updatedAt: string; convexId?: string }[]
): Promise<void> {
  await db.transaction('rw', db.expenses, async () => {
    for (const entry of entries) {
      const current = await db.expenses.get(entry.id);
      if (!current) continue;

      const currentUpdatedAt = current.updatedAt ?? current.timestamp;
      if (currentUpdatedAt === entry.updatedAt) {
        await db.expenses.update(entry.id, {
          isSynced: true,
          convexId: entry.convexId,
        });
      }
    }
  });
}

export async function applyRemoteExpenses(remote: RemoteExpense[]): Promise<void> {
  await db.transaction('rw', db.expenses, async () => {
    for (const r of remote) {
      const local = await db.expenses.get(r.localId);
      const remoteUpdatedAt = r.updatedAt ?? r.timestamp;

      if (local) {
        const localUpdatedAt = local.updatedAt ?? local.timestamp;
        if (remoteUpdatedAt <= localUpdatedAt) continue;
      } else if (r.deleted) {
        continue;
      }

      await db.expenses.put({
        id: r.localId,
        convexId: r._id ?? local?.convexId,
        amount: r.amount,
        currency: r.currency,
        amountInALL: r.amountInALL,
        category: r.category as Category,
        subcategory: r.subcategory,
        vendorType: r.vendorType as VendorType | undefined,
        foodType: r.foodType as FoodType | undefined,
        itemName: r.itemName,
        estimatedMeals: r.estimatedMeals,
        paidWith: r.paidWith as PaymentSource | undefined,
        timestamp: r.timestamp,
        updatedAt: remoteUpdatedAt,
        deleted: r.deleted,
        isSynced: true,
      });
    }
  });
}

export async function getHistoricalItemNames(): Promise<string[]> {
  const items = await db.expenses
    .filter((e) => !e.deleted && Boolean(e.itemName && e.itemName.trim().length > 0))
    .toArray();

  const namesSet = new Set<string>();
  for (const item of items) {
    if (item.itemName) {
      namesSet.add(item.itemName.trim());
    }
  }
  return Array.from(namesSet);
}

// ---------- Transfer helpers ----------

export async function addTransfer(data: {
  amountALL: number;
  direction: TransferDirection;
  timestamp?: string;
}): Promise<TransferRecord> {
  const now = new Date().toISOString();
  const record: TransferRecord = {
    id: crypto.randomUUID(),
    amountALL: data.amountALL,
    direction: data.direction,
    timestamp: data.timestamp || now,
    isSynced: false,
    updatedAt: now,
  };
  await db.transfers.add(record);
  return record;
}

export async function getTransfers(): Promise<TransferRecord[]> {
  return db.transfers
    .orderBy('timestamp')
    .reverse()
    .filter((t) => !t.deleted)
    .toArray();
}

export async function deleteTransfer(id: string): Promise<void> {
  await db.transfers.update(id, {
    deleted: true,
    isSynced: false,
    updatedAt: new Date().toISOString(),
  });
}

export async function getUnsyncedTransfers(): Promise<TransferRecord[]> {
  return db.transfers.filter((t) => !t.isSynced).toArray();
}

export async function markTransfersSyncedIfUnchanged(
  entries: { id: string; updatedAt: string; convexId?: string }[]
): Promise<void> {
  await db.transaction('rw', db.transfers, async () => {
    for (const entry of entries) {
      const current = await db.transfers.get(entry.id);
      if (!current) continue;

      const currentUpdatedAt = current.updatedAt ?? current.timestamp;
      if (currentUpdatedAt === entry.updatedAt) {
        await db.transfers.update(entry.id, {
          isSynced: true,
          convexId: entry.convexId,
        });
      }
    }
  });
}

export async function applyRemoteTransfers(remote: RemoteTransfer[]): Promise<void> {
  await db.transaction('rw', db.transfers, async () => {
    for (const r of remote) {
      const local = await db.transfers.get(r.localId);
      const remoteUpdatedAt = r.updatedAt ?? r.timestamp;

      if (local) {
        const localUpdatedAt = local.updatedAt ?? local.timestamp;
        if (remoteUpdatedAt <= localUpdatedAt) continue;
      } else if (r.deleted) {
        continue;
      }

      await db.transfers.put({
        id: r.localId,
        convexId: r._id ?? local?.convexId,
        amountALL: r.amountALL,
        direction: r.direction as TransferDirection,
        timestamp: r.timestamp,
        updatedAt: remoteUpdatedAt,
        deleted: r.deleted,
        isSynced: true,
      });
    }
  });
}

// ---------- Budget cycle helpers ----------

export async function saveBudgetCycle(cycle: BudgetCycle): Promise<void> {
  const now = new Date().toISOString();
  await db.budgetCycles.put({
    ...cycle,
    isSynced: false,
    updatedAt: cycle.updatedAt ?? now,
  });
}

export async function getCurrentBudgetCycle(): Promise<BudgetCycle | undefined> {
  return db.budgetCycles
    .orderBy('startDate')
    .reverse()
    .filter((c) => !c.deleted)
    .first();
}

export async function getUnsyncedBudgetCycles(): Promise<BudgetCycle[]> {
  return db.budgetCycles.filter((c) => !c.isSynced).toArray();
}

export async function markBudgetCyclesSyncedIfUnchanged(
  entries: { id: string; updatedAt: string; convexId?: string }[]
): Promise<void> {
  await db.transaction('rw', db.budgetCycles, async () => {
    for (const entry of entries) {
      const current = await db.budgetCycles.get(entry.id);
      if (!current) continue;

      const currentUpdatedAt = current.updatedAt ?? current.startDate;
      if (currentUpdatedAt === entry.updatedAt) {
        await db.budgetCycles.update(entry.id, {
          isSynced: true,
          convexId: entry.convexId,
        });
      }
    }
  });
}

export async function applyRemoteBudgetCycles(remote: RemoteBudgetCycle[]): Promise<void> {
  await db.transaction('rw', db.budgetCycles, async () => {
    for (const r of remote) {
      const local = await db.budgetCycles.get(r.localId);
      const remoteUpdatedAt = r.updatedAt ?? r.startDate;

      if (local) {
        const localUpdatedAt = local.updatedAt ?? local.startDate;
        if (remoteUpdatedAt <= localUpdatedAt) continue;
      } else if (r.deleted) {
        continue;
      }

      await db.budgetCycles.put({
        id: r.localId,
        convexId: r._id ?? local?.convexId,
        startDate: r.startDate,
        targetEndDate: r.targetEndDate,
        stipendAmountALL: r.stipendAmountALL,
        startingRaiffeisenBalanceALL: r.startingRaiffeisenBalanceALL,
        startingCashALL: r.startingCashALL,
        bufferPoolALL: r.bufferPoolALL,
        travelStashALL: r.travelStashALL,
        updatedAt: remoteUpdatedAt,
        deleted: r.deleted,
        isSynced: true,
      });
    }
  });
}

// ---------- Export helpers ----------

export async function exportToCSV(): Promise<string> {
  const expenses = await getExpenses();
  return generateCSV(expenses);
}

export async function exportToJSON(): Promise<string> {
  const expenses = await getExpenses();
  return generateJSON(expenses);
}