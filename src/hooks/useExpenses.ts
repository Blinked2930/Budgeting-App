// src/hooks/useExpenses.ts
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { ExpenseRecord } from '../types';

const EMPTY: ExpenseRecord[] = [];

export function useExpenses() {
    // Visible expenses only (soft-deleted rows are hidden)
    const result = useLiveQuery(
        () =>
            db.expenses
                .orderBy('timestamp')
                .reverse()
                .filter((e) => !e.deleted)
                .toArray(),
        []
    );

    // Includes pending delete tombstones, so the header count reflects
    // everything still waiting to sync.
    const unsyncedResult = useLiveQuery(
        () => db.expenses.filter((e) => !e.isSynced).count(),
        []
    );

    const expenses = result ?? EMPTY;

    const totalSpentALL = useMemo(
        () =>
            expenses.reduce((sum, e) => {
                // Skip debt settlements and other people's shares
                if (e.debtRelated || e.walletNeutral) return sum;
                // Only count actual outflows (expenses, not refunds/income)
                if (e.amount <= 0) return sum;
                
                // Use budgetAmountALL if it exists (for split bills), otherwise amountInALL
                return sum + (e.budgetAmountALL ?? e.amountInALL);
            }, 0),
        [expenses]
    );

    return {
        expenses,
        totalSpentALL,
        unsyncedCount: unsyncedResult ?? 0,
        isLoading: result === undefined,
    };
}