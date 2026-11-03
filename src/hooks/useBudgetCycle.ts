// src/hooks/useBudgetCycle.ts
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getCurrentBudgetCycle } from '../db';
import { useExpenses } from './useExpenses';
import { useTransfers } from './useTransfers';
import { useDebts } from './useDebts';
import { computeBudgetStats, snapshotFromGroups } from '../utils/budget';

export function useBudgetCycle() {
    const { expenses } = useExpenses();
    const { transfers } = useTransfers();
    const { openDebts } = useDebts();

    const cycleResult = useLiveQuery(
        async () => (await getCurrentBudgetCycle()) ?? null,
        []
    );

    const myGroups = useQuery((api as any).groups?.getMyGroups, {}) || [];
    const splitupSnapshot = useMemo(() => snapshotFromGroups(myGroups), [myGroups]);

    const prefs = useQuery((api as any).preferences?.getMyPreferences, {}) as
        | { baseCurrency: string }
        | undefined;
    const baseCurrency: string = prefs?.baseCurrency ?? 'ALL';

    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    const cycle = cycleResult ?? null;

    const stats = useMemo(
        () =>
            cycle
                ? computeBudgetStats(cycle, expenses, transfers, openDebts, splitupSnapshot, now)
                : null,
        [cycle, expenses, transfers, openDebts, splitupSnapshot, now]
    );

    return { cycle, stats, baseCurrency, isLoading: cycleResult === undefined };
}