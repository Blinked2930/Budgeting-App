// src/hooks/useConvexSync.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
    getUnsyncedExpenses,
    markSyncedIfUnchanged,
    getUnsyncedBudgetCycles,
    markBudgetCyclesSyncedIfUnchanged,
    getUnsyncedTransfers,
    markTransfersSyncedIfUnchanged,
    applyRemoteExpenses,
    applyRemoteBudgetCycles,
    applyRemoteTransfers,
} from '../db';

export function useConvexSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const isSyncingRef = useRef(false);

    const upsertExpenseMutation = useMutation(api.expenses.upsertExpense);
    const upsertBudgetCycleMutation = useMutation(api.budgetCycles.upsertBudgetCycle);
    const upsertTransferMutation = useMutation(api.transfers.upsertTransfer);

    const remoteExpenses = useQuery(api.expenses.getRemoteExpenses);
    const remoteBudgetCycles = useQuery(api.budgetCycles.getRemoteBudgetCycles);
    const remoteTransfers = useQuery(api.transfers.getRemoteTransfers);

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
                    paidWith: item.paidWith,
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
                    startingCashALL: cycle.startingCashALL,
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

    const syncPendingTransfers = useCallback(async () => {
        if (!navigator.onLine || isSyncingRef.current) return;

        try {
            isSyncingRef.current = true;
            setIsSyncing(true);

            const unsynced = await getUnsyncedTransfers();
            const pushed: { id: string; updatedAt: string; convexId?: string }[] = [];

            for (const t of unsynced) {
                const updatedAt = t.updatedAt ?? t.timestamp;

                const convexId = await upsertTransferMutation({
                    localId: t.id,
                    amountALL: t.amountALL,
                    direction: t.direction,
                    timestamp: t.timestamp,
                    updatedAt,
                    deleted: t.deleted,
                });

                if (convexId) {
                    pushed.push({ id: t.id, updatedAt, convexId: String(convexId) });
                }
            }

            if (pushed.length > 0) {
                await markTransfersSyncedIfUnchanged(pushed);
            }
        } catch (err) {
            console.error('Background transfer sync failed:', err);
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [upsertTransferMutation]);

    const syncPending = useCallback(async () => {
        await syncPendingExpenses();
        await syncPendingBudgetCycles();
        await syncPendingTransfers();
    }, [syncPendingExpenses, syncPendingBudgetCycles, syncPendingTransfers]);

    useEffect(() => {
        if (!remoteExpenses) return;
        applyRemoteExpenses(remoteExpenses).catch((err) => {
            console.error('Failed to apply remote expenses:', err);
        });
    }, [remoteExpenses]);

    useEffect(() => {
        if (!remoteBudgetCycles) return;
        applyRemoteBudgetCycles(remoteBudgetCycles).catch((err) => {
            console.error('Failed to apply remote cycles:', err);
        });
    }, [remoteBudgetCycles]);

    useEffect(() => {
        if (!remoteTransfers) return;
        applyRemoteTransfers(remoteTransfers).catch((err) => {
            console.error('Failed to apply remote transfers:', err);
        });
    }, [remoteTransfers]);

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
        syncPendingTransfers,
        syncPending,
        isSyncing,
    };
}