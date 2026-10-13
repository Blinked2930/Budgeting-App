import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { ExpenseRecord } from '../types';

const EMPTY: ExpenseRecord[] = [];

export function useExpenses() {
    const result = useLiveQuery(
        () => db.expenses.orderBy('timestamp').reverse().toArray(),
        []
    );

    const expenses = result ?? EMPTY;

    const totalSpentALL = useMemo(
        () => expenses.reduce((sum, e) => sum + e.amountInALL, 0),
        [expenses]
    );

    const unsyncedCount = useMemo(
        () => expenses.filter((e) => !e.isSynced).length,
        [expenses]
    );

    return {
        expenses,
        totalSpentALL,
        unsyncedCount,
        isLoading: result === undefined,
    };
}