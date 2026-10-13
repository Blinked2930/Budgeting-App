// src/hooks/useConvexSync.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
    getUnsyncedExpenses,
    markSyncedIfUnchanged,
    getUnsyncedBudgetCycles,
    markBudgetCyclesSyncedIfUnchanged,
    applyRemoteExpenses,
    applyRemoteBudgetCycles,
} from '../db';

export function useConvexSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const isSyncingRef = useRef(false);

    const upsertExpenseMutation = useMutation(api.expenses.upsertExpense);
    const upsertBudgetCycleMutation = useMutation(api.budgetCycles.upsertBudgetCycle);

    // Live queries — Convex pushes updates whenever the cloud data changes.
    const remoteExpenses = useQuery(api.expenses.getRemoteExpenses);
    const remoteBudgetCycles = useQuery(api.budgetCycles.getRemoteBudgetCycles);

    const syncPendingExpenses = useCallback(async () => {
        if (!navigator.onLine || isSyncingRef.current) return;

        try {
            isSyncingRef.current = true;
            setIsSyncing(true);

            const unsynced = await getUnsyncedExpenses();
            const pushed: { id: string; updatedAt: string; convexId?: string }[] = [];

            for (const item of unsynced) {
                const updatedAt = item.updatedAt ?? item.timestamp;

                const convexId = await upsertExpenseMutation({
                    localId: item.id,
                    amount: item.amount,
                    currency: item.currency,
                    amountInALL: item.amountInALL,
                    category: item.category,
                    vendorType: item.vendorType,
                    foodType: item.foodType,
                    itemName: item.itemName,
                    estimatedMeals: item.estimatedMeals,
                    timestamp: item.timestamp,
                    updatedAt,
                    deleted: item.deleted,
                });

                if (convexId) {
                    pushed.push({ id: item.id, updatedAt, convexId: String(convexId) });
                }
            }

            if (pushed.length > 0) {
                await markSyncedIfUnchanged(pushed);
            }
        } catch (err) {
            console.error('Background expense sync failed:', err);
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [upsertExpenseMutation]);

    const syncPendingBudgetCycles = useCallback(async () => {
        if (!navigator.onLine || isSyncingRef.current) return;

        try {
            isSyncingRef.current = true;
            setIsSyncing(true);

            const unsynced = await getUnsyncedBudgetCycles();
            const pushed: { id: string; updatedAt: string; convexId?: string }[] = [];

            for (const cycle of unsynced) {
                const updatedAt = cycle.updatedAt ?? cycle.startDate;

                const convexId = await upsertBudgetCycleMutation({
                    localId: cycle.id,
                    startDate: cycle.startDate,
                    targetEndDate: cycle.targetEndDate,
                    stipendAmountALL: cycle.stipendAmountALL,
                    startingRaiffeisenBalanceALL: cycle.startingRaiffeisenBalanceALL,
                    bufferPoolALL: cycle.bufferPoolALL,
                    travelStashALL: cycle.travelStashALL,
                    updatedAt,
                    deleted: cycle.deleted,
                });

                if (convexId) {
                    pushed.push({ id: cycle.id, updatedAt, convexId: String(convexId) });
                }
            }

            if (pushed.length > 0) {
                await markBudgetCyclesSyncedIfUnchanged(pushed);
            }
        } catch (err) {
            console.error('Background cycle sync failed:', err);
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [upsertBudgetCycleMutation]);

    const syncPending = useCallback(async () => {
        await syncPendingExpenses();
        await syncPendingBudgetCycles();
    }, [syncPendingExpenses, syncPendingBudgetCycles]);

    // Pull remote expenses whenever Convex sends an update.
    useEffect(() => {
        if (!remoteExpenses) return;
        applyRemoteExpenses(remoteExpenses).catch((err) => {
            console.error('Failed to apply remote expenses:', err);
        });
    }, [remoteExpenses]);

    // Pull remote budget cycles whenever Convex sends an update.
    useEffect(() => {
        if (!remoteBudgetCycles) return;
        applyRemoteBudgetCycles(remoteBudgetCycles).catch((err) => {
            console.error('Failed to apply remote cycles:', err);
        });
    }, [remoteBudgetCycles]);

    useEffect(() => {
        syncPending();

        const handleOnline = () => syncPending();
        window.addEventListener('online', handleOnline);

        const interval = setInterval(syncPending, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            clearInterval(interval);
        };
    }, [syncPending]);

    return {
        syncPendingExpenses,
        syncPendingBudgetCycles,
        syncPending,
        isSyncing,
    };
}