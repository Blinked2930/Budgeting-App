import { useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { db } from '../db';
import type { ExpenseRecord } from '../types';
import { useConvexSync } from '../hooks/useConvexSync';

export function SyncManager() {
    // Push: local un-synced expenses -> Convex
    useConvexSync();

    // Pull: Convex expenses -> local Dexie (live subscription)
    const remoteExpenses = useQuery(api.expenses.getRemoteExpenses);

    useEffect(() => {
        if (!remoteExpenses) return;

        const pullMissing = async () => {
            try {
                const localIds = new Set(
                    (await db.expenses.toCollection().primaryKeys()) as string[]
                );

                const missing: ExpenseRecord[] = remoteExpenses
                    .filter((r) => !localIds.has(r.localId))
                    .map((r) => ({
                        id: r.localId,
                        amount: r.amount,
                        currency: r.currency,
                        amountInALL: r.amountInALL,
                        category: r.category as ExpenseRecord['category'],
                        vendorType: r.vendorType as ExpenseRecord['vendorType'],
                        foodType: r.foodType as ExpenseRecord['foodType'],
                        itemName: r.itemName,
                        estimatedMeals: r.estimatedMeals,
                        timestamp: r.timestamp,
                        updatedAt: r.timestamp,
                        isSynced: true,
                    }));

                if (missing.length > 0) {
                    await db.expenses.bulkPut(missing);
                }
            } catch (err) {
                console.error('Pulling remote expenses failed:', err);
            }
        };

        pullMissing();
    }, [remoteExpenses]);

    return null;
}