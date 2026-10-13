import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getCurrentBudgetCycle } from '../db';
import { useExpenses } from './useExpenses';
import { computeBudgetStats } from '../utils/budget';

export function useBudgetCycle() {
    const { expenses } = useExpenses();

    // undefined = still loading, null = no cycle saved yet
    const cycleResult = useLiveQuery(
        async () => (await getCurrentBudgetCycle()) ?? null,
        []
    );

    // Re-evaluate once a minute so the numbers roll over at midnight
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    const cycle = cycleResult ?? null;

    const stats = useMemo(
        () => (cycle ? computeBudgetStats(cycle, expenses, now) : null),
        [cycle, expenses, now]
    );

    return { cycle, stats, isLoading: cycleResult === undefined };
}