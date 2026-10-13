import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getUnsyncedExpenses, markSyncedIfUnchanged } from '../db';

export function useConvexSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const isSyncingRef = useRef(false);
    const upsertExpenseMutation = useMutation(api.expenses.upsertExpense);

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
            console.error('Background sync failed:', err);
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [upsertExpenseMutation]);

    useEffect(() => {
        syncPendingExpenses();

        const handleOnline = () => syncPendingExpenses();
        window.addEventListener('online', handleOnline);

        const interval = setInterval(syncPendingExpenses, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            clearInterval(interval);
        };
    }, [syncPendingExpenses]);

    return { syncPendingExpenses, isSyncing };
}