import { useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { applyRemoteExpenses } from '../db';
import { useConvexSync } from '../hooks/useConvexSync';

export function SyncManager() {
    // Push: local un-synced expenses (new, edited, deleted) -> Convex
    useConvexSync();

    // Pull: Convex expenses -> local Dexie (live subscription, last-write-wins)
    const remoteExpenses = useQuery(api.expenses.getRemoteExpenses);

    useEffect(() => {
        if (!remoteExpenses) return;

        applyRemoteExpenses(remoteExpenses).catch((err) => {
            console.error('Pulling remote expenses failed:', err);
        });
    }, [remoteExpenses]);

    return null;
}