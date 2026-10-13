import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { ExpenseRecord } from '../types';

export function useExpenses(limit?: number) {
  const expenses = useLiveQuery(
    async () => {
      const query = db.expenses.orderBy('timestamp').reverse();
      if (limit) {
        return query.limit(limit).toArray();
      }
      return query.toArray();
    },
    [limit],
    [] as ExpenseRecord[]
  );

  const unsyncedCount = useLiveQuery(
    () => db.expenses.filter((e) => !e.isSynced).count(),
    [],
    0
  );

  const totalSpentALL = (expenses || []).reduce(
    (sum, exp) => sum + (exp.amountInALL || 0),
    0
  );

  return {
    expenses: expenses || [],
    unsyncedCount: unsyncedCount || 0,
    totalSpentALL,
    isLoading: expenses === undefined,
  };
}
