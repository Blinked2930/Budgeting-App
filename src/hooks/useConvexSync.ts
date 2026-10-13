import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getUnsyncedExpenses, markExpensesAsSynced } from '../db';

export function useConvexSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const isSyncingRef = useRef(false);
    const syncExpenseMutation = useMutation(api.expenses.syncExpense);

    const syncPendingExpenses = useCallback(async () => {
        if (!navigator.onLine || isSyncingRef.current) return;

        try {
            isSyncingRef.current = true;
            setIsSyncing(true);

            const unsynced = await getUnsyncedExpenses();
            const syncedIds: string[] = [];

            for (const item of unsynced) {
                const convexId = await syncExpenseMutation({
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
                });

                if (convexId) {
                    syncedIds.push(item.id);
                }
            }

            if (syncedIds.length > 0) {
                await markExpensesAsSynced(syncedIds);
            }
        } catch (err) {
            console.error('Background sync failed:', err);
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [syncExpenseMutation]);

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