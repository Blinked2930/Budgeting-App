// src/hooks/useDebts.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { DebtRecord } from '../types';

export function useDebts() {
    const debts = useLiveQuery(
        () => db.debts.filter((d) => !d.deleted).reverse().sortBy('createdAt'),
        []
    );

    const openDebts = useLiveQuery(
        () => db.debts.filter((d) => !d.deleted && d.status === 'open').toArray(),
        []
    );

    return {
        debts: (debts ?? []) as DebtRecord[],
        openDebts: (openDebts ?? []) as DebtRecord[],
    };
}