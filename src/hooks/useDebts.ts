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

    const resolvedDebts = useLiveQuery(
        () => db.debts.filter((d) => !d.deleted && d.status === 'resolved').reverse().sortBy('resolvedAt'),
        []
    );

    const allDebtsList = (debts ?? []) as DebtRecord[];
    const openDebtsList = (openDebts ?? []) as DebtRecord[];
    const resolvedDebtsList = (resolvedDebts ?? []) as DebtRecord[];

    let totalOwedToMe = 0;
    let totalIOwe = 0;

    for (const d of openDebtsList) {
        if (d.direction === 'OwedToMe') {
            totalOwedToMe += d.remainingALL;
        } else {
            totalIOwe += d.remainingALL;
        }
    }

    const netBalance = totalOwedToMe - totalIOwe;

    return {
        debts: allDebtsList,
        openDebts: openDebtsList,
        resolvedDebts: resolvedDebtsList,
        totalOwedToMe,
        totalIOwe,
        netBalance,
    };
}