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
    getUnsyncedDebts,
    markDebtsSyncedIfUnchanged,
    applyRemoteExpenses,
    applyRemoteBudgetCycles,
    applyRemoteTransfers,
    applyRemoteDebts,
} from '../db';

export function useConvexSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const isSyncingRef = useRef(false);

    const upsertExpenseMutation = useMutation(api.expenses.upsertExpense);
    const upsertBudgetCycleMutation = useMutation(api.budgetCycles.upsertBudgetCycle);
    const upsertTransferMutation = useMutation(api.transfers.upsertTransfer);
    const upsertDebtMutation = useMutation(api.debts.upsertDebt);

    const remoteExpenses = useQuery(api.expenses.getRemoteExpenses);
    const remoteBudgetCycles = useQuery(api.budgetCycles.getRemoteBudgetCycles);
    const remoteTransfers = useQuery(api.transfers.getRemoteTransfers);
    const remoteDebts = useQuery(api.debts.getRemoteDebts);

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
                    budgetAmountALL: item.budgetAmountALL,
                    debtId: item.debtId,
                    debtRelated: item.debtRelated,
                    walletNeutral: item.walletNeutral,
                    isDebtOrigin: item.isDebtOrigin,
                    isBigExpense: item.isBigExpense,
                    isForgiveness: item.isForgiveness,
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
                    plannedBigExpensesALL: cycle.plannedBigExpensesALL,
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

    const syncPendingDebts = useCallback(async () => {
        if (!navigator.onLine || isSyncingRef.current) return;

        try {
            isSyncingRef.current = true;
            setIsSyncing(true);

            const unsynced = await getUnsyncedDebts();
            const pushed: { id: string; updatedAt: string; convexId?: string }[] = [];

            for (const d of unsynced) {
                const updatedAt = d.updatedAt ?? d.createdAt;

                const convexId = await upsertDebtMutation({
                    localId: d.id,
                    counterparty: d.counterparty,
                    counterpartyKey: d.counterpartyKey,
                    direction: d.direction,
                    amountALL: d.amountALL,
                    remainingALL: d.remainingALL,
                    note: d.note,
                    status: d.status,
                    sourceExpenseId: d.sourceExpenseId,
                    myShareAmountALL: d.myShareAmountALL,
                    createdAt: d.createdAt,
                    resolvedAt: d.resolvedAt,
                    updatedAt,
                    deleted: d.deleted,
                });

                if (convexId) {
                    pushed.push({ id: d.id, updatedAt, convexId: String(convexId) });
                }
            }

            if (pushed.length > 0) {
                await markDebtsSyncedIfUnchanged(pushed);
            }
        } catch (err) {
            console.error('Background debt sync failed:', err);
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [upsertDebtMutation]);

    const syncPending = useCallback(async () => {
        await syncPendingExpenses();
        await syncPendingBudgetCycles();
        await syncPendingTransfers();
        await syncPendingDebts();
    }, [syncPendingExpenses, syncPendingBudgetCycles, syncPendingTransfers, syncPendingDebts]);

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
        if (!remoteDebts) return;
        applyRemoteDebts(remoteDebts).catch((err) => {
            console.error('Failed to apply remote debts:', err);
        });
    }, [remoteDebts]);

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
        syncPendingDebts,
        syncPending,
        isSyncing,
    };
}
