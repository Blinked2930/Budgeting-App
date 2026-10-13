import { useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { db } from '../db';

export function useConvexSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const syncExpenseMutation = useMutation(api.expenses.syncExpense);

    const syncPendingExpenses = async () => {
        if (!navigator.onLine || isSyncing) return;

        try {
            setIsSyncing(true);
            const unsynced = await db.expenses.where('isSynced').equals(0).toArray();

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
                    await db.expenses.update(item.id, {
                        isSynced: true,
                        convexId: convexId as string,
                    });
                }
            }
        } catch (err) {
            console.error('Background sync failed:', err);
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        syncPendingExpenses();

        const handleOnline = () => syncPendingExpenses();
        window.addEventListener('online', handleOnline);

        const interval = setInterval(syncPendingExpenses, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            clearInterval(interval);
        };
    }, []);

    return { syncPendingExpenses, isSyncing };
}