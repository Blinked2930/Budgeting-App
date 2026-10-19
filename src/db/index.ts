// src/db/index.ts
import Dexie, { type Table } from 'dexie';
import type {
  BudgetCycle,
  Category,
  Currency,
  DebtDirection,
  DebtRecord,
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
  debts!: Table<DebtRecord, string>;

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
    this.version(3).stores({
      expenses: 'id, timestamp, category, vendorType, isSynced, amountInALL',
      budgetCycles: 'id, startDate, targetEndDate, isSynced, updatedAt',
      transfers: 'id, timestamp, isSynced, updatedAt',
    });
    this.version(4).stores({
      expenses: 'id, timestamp, category, vendorType, isSynced, amountInALL',
      budgetCycles: 'id, startDate, targetEndDate, isSynced, updatedAt',
      transfers: 'id, timestamp, isSynced, updatedAt',
      debts: 'id, counterpartyKey, status, direction, isSynced, updatedAt',
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
  budgetAmountALL?: number;
  debtId?: string;
  debtRelated?: boolean;
  walletNeutral?: boolean;
  isDebtOrigin?: boolean;
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

export interface RemoteDebt {
  _id?: string;
  localId: string;
  counterparty: string;
  counterpartyKey: string;
  direction: string;
  amountALL: number;
  remainingALL: number;
  note?: string;
  status: string;
  sourceExpenseId?: string;
  createdAt: string;
  resolvedAt?: string;
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
        budgetAmountALL: r.budgetAmountALL,
        debtId: r.debtId,
        debtRelated: r.debtRelated,
        walletNeutral: r.walletNeutral,
        isDebtOrigin: r.isDebtOrigin,
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

// ---------- Debt helpers ----------

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

export async function addDebt(data: {
  counterparty: string;
  direction: DebtDirection;
  amountALL: number;
  note?: string;
  sourceExpenseId?: string;
  timestamp?: string;
  moveWalletWith?: PaymentSource;
  purchaseDetails?: { category: Category; itemName?: string };
}): Promise<DebtRecord> {
  const now = new Date().toISOString();
  const record: DebtRecord = {
    id: crypto.randomUUID(),
    counterparty: data.counterparty.trim(),
    counterpartyKey: normalizeKey(data.counterparty),
    direction: data.direction,
    amountALL: data.amountALL,
    remainingALL: data.amountALL,
    note: data.note,
    status: 'open',
    sourceExpenseId: data.sourceExpenseId,
    createdAt: data.timestamp ?? now,
    isSynced: false,
    updatedAt: now,
  };
  await db.debts.add(record);

  if (data.moveWalletWith && !data.sourceExpenseId) {
    // Cash loan: money physically moved.
    const signedAmount = data.direction === 'iOwe' ? -data.amountALL : data.amountALL;

    const baseName = data.direction === 'iOwe'
      ? `Borrowed from ${record.counterparty}`
      : `Lent to ${record.counterparty}`;
    const itemName = data.note ? `${baseName} (${data.note})` : baseName;

    await addExpense({
      amount: signedAmount,
      currency: 'ALL',
      category: 'Other',
      itemName: itemName,
      paidWith: data.moveWalletWith,
      debtId: record.id,
      debtRelated: true,
      isDebtOrigin: true,
    });
  } else if (data.purchaseDetails) {
    // Someone bought something for me.
    await addExpense({
      amount: data.amountALL, // Positive expense
      currency: 'ALL',
      category: data.purchaseDetails.category,
      itemName: data.purchaseDetails.itemName || `Bought by ${record.counterparty}`,
      walletNeutral: true, // Does not touch cash/bank
      debtId: record.id,
    });
  }

  return record;
}

export async function getDebts(): Promise<DebtRecord[]> {
  return db.debts
    .orderBy('createdAt')
    .reverse()
    .filter((d) => !d.deleted)
    .toArray();
}

export async function getOpenDebts(): Promise<DebtRecord[]> {
  return db.debts.filter((d) => !d.deleted && d.status === 'open').toArray();
}

export async function getDebt(id: string): Promise<DebtRecord | undefined> {
  const d = await db.debts.get(id);
  return d && !d.deleted ? d : undefined;
}

/**
 * Delete a debt AND every wallet movement created by it.
 */
export async function deleteDebt(id: string): Promise<void> {
  const debt = await db.debts.get(id);
  if (!debt || debt.deleted) return;

  await db.debts.update(id, {
    deleted: true,
    isSynced: false,
    updatedAt: new Date().toISOString(),
  });

  const linkedExpenses = await db.expenses
    .filter((e) => e.debtId === id && !e.deleted)
    .toArray();
  for (const e of linkedExpenses) {
    await deleteExpense(e.id);
  }
}

export async function settleDebtCash(
  debtId: string,
  amountALL: number,
  paidWith: PaymentSource
): Promise<void> {
  const debt = await getDebt(debtId);
  if (!debt || debt.status !== 'open') return;

  const clamped = Math.min(amountALL, debt.remainingALL);
  if (clamped <= 0) return;

  const signedAmount = debt.direction === 'OwedToMe' ? -clamped : clamped;

  const baseName = debt.direction === 'OwedToMe'
    ? `Repaid by ${debt.counterparty}`
    : `Repaid to ${debt.counterparty}`;
  const itemName = debt.note ? `${baseName} (${debt.note})` : baseName;

  await addExpense({
    amount: signedAmount,
    currency: 'ALL',
    category: 'Other',
    itemName: itemName,
    paidWith,
    debtId: debt.id,
    debtRelated: true,
  });

  const newRemaining = debt.remainingALL - clamped;
  const isResolved = newRemaining <= 0;
  await db.debts.update(debt.id, {
    remainingALL: newRemaining,
    status: isResolved ? 'resolved' : 'open',
    resolvedAt: isResolved ? new Date().toISOString() : undefined,
    isSynced: false,
    updatedAt: new Date().toISOString(),
  });
}

export async function settleDebtNonCash(
  debtId: string,
  amountALL: number,
  paidWith: PaymentSource = 'Cash'
): Promise<void> {
  const debt = await getDebt(debtId);
  if (!debt || debt.status !== 'open') return;

  const clamped = Math.min(amountALL, debt.remainingALL);
  if (clamped <= 0) return;

  if (debt.direction === 'OwedToMe') {
    const baseName = `Offset from ${debt.counterparty}`;
    const itemName = debt.note ? `${baseName} (${debt.note})` : baseName;
    await addExpense({
      amount: clamped,
      currency: 'ALL',
      category: 'Other',
      itemName: itemName,
      walletNeutral: true,
      debtId: debt.id,
      debtRelated: false,
    });
  } else {
    const baseName = `Offset to ${debt.counterparty}`;
    const itemName = debt.note ? `${baseName} (${debt.note})` : baseName;
    await addExpense({
      amount: clamped,
      currency: 'ALL',
      category: 'Other',
      itemName: itemName,
      paidWith,
      debtId: debt.id,
      debtRelated: true,
    });
  }

  const newRemaining = debt.remainingALL - clamped;
  const isResolved = newRemaining <= 0;
  await db.debts.update(debt.id, {
    remainingALL: newRemaining,
    status: isResolved ? 'resolved' : 'open',
    resolvedAt: isResolved ? new Date().toISOString() : undefined,
    isSynced: false,
    updatedAt: new Date().toISOString(),
  });
}

export async function writeOffDebt(debtId: string): Promise<void> {
  const debt = await getDebt(debtId);
  if (!debt || debt.status !== 'open') return;
  const amount = debt.remainingALL;
  if (amount <= 0) return;

  if (debt.direction === 'iOwe') {
    await db.debts.update(debt.id, {
      remainingALL: 0,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      isSynced: false,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (debt.sourceExpenseId) {
    const source = await db.expenses.get(debt.sourceExpenseId);
    if (source && !source.deleted) {
      const newBudget = Math.min(
        source.amountInALL,
        (source.budgetAmountALL ?? source.amountInALL) + amount
      );
      await updateExpense(source.id, { budgetAmountALL: newBudget });
    }
  } else {
    const baseName = `Gift to ${debt.counterparty}`;
    const itemName = debt.note ? `${baseName} (${debt.note})` : baseName;
    await addExpense({
      amount,
      currency: 'ALL',
      category: 'Other',
      itemName: itemName,
      walletNeutral: true,
      debtId: debt.id,
    });
  }

  await db.debts.update(debt.id, {
    remainingALL: 0,
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    isSynced: false,
    updatedAt: new Date().toISOString(),
  });
}

export async function getCounterparties(): Promise<string[]> {
  const all = await db.debts.filter((d) => !d.deleted).toArray();
  const map = new Map<string, { name: string; count: number; latest: number }>();

  for (const d of all) {
    const key = d.counterpartyKey;
    const existing = map.get(key);
    const ts = new Date(d.createdAt).getTime();
    if (existing) {
      existing.count += 1;
      if (ts > existing.latest) existing.latest = ts;
    } else {
      map.set(key, { name: d.counterparty, count: 1, latest: ts });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || b.latest - a.latest)
    .map((m) => m.name);
}

export async function getUnsyncedDebts(): Promise<DebtRecord[]> {
  return db.debts.filter((d) => !d.isSynced).toArray();
}

export async function markDebtsSyncedIfUnchanged(
  entries: { id: string; updatedAt: string; convexId?: string }[]
): Promise<void> {
  await db.transaction('rw', db.debts, async () => {
    for (const entry of entries) {
      const current = await db.debts.get(entry.id);
      if (!current) continue;

      const currentUpdatedAt = current.updatedAt ?? current.createdAt;
      if (currentUpdatedAt === entry.updatedAt) {
        await db.debts.update(entry.id, {
          isSynced: true,
          convexId: entry.convexId,
        });
      }
    }
  });
}

export async function applyRemoteDebts(remote: RemoteDebt[]): Promise<void> {
  await db.transaction('rw', db.debts, async () => {
    for (const r of remote) {
      const local = await db.debts.get(r.localId);
      const remoteUpdatedAt = r.updatedAt ?? r.createdAt;

      if (local) {
        const localUpdatedAt = local.updatedAt ?? local.createdAt;
        if (remoteUpdatedAt <= localUpdatedAt) continue;
      } else if (r.deleted) {
        continue;
      }

      await db.debts.put({
        id: r.localId,
        convexId: r._id ?? local?.convexId,
        counterparty: r.counterparty,
        counterpartyKey: r.counterpartyKey,
        direction: r.direction as DebtDirection,
        amountALL: r.amountALL,
        remainingALL: r.remainingALL,
        note: r.note,
        status: r.status as 'open' | 'resolved',
        sourceExpenseId: r.sourceExpenseId,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
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
  const [exps, dbt, trf, cyc] = await Promise.all([
    db.expenses.toArray(),
    db.debts.toArray(),
    db.transfers.toArray(),
    db.budgetCycles.toArray(),
  ]);
  return generateCSV(exps, dbt, trf, cyc);
}

export async function exportToJSON(): Promise<string> {
  const [exps, dbt, trf, cyc] = await Promise.all([
    db.expenses.toArray(),
    db.debts.toArray(),
    db.transfers.toArray(),
    db.budgetCycles.toArray(),
  ]);
  return generateJSON(exps, dbt, trf, cyc);
}