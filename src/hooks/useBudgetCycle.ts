// src/hooks/useBudgetCycle.ts
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getCurrentBudgetCycle } from '../db';
import { useExpenses } from './useExpenses';
import { useTransfers } from './useTransfers';
import { computeBudgetStats } from '../utils/budget';

export function useBudgetCycle() {
    const { expenses } = useExpenses();
    const { transfers } = useTransfers();

    const cycleResult = useLiveQuery(
        async () => (await getCurrentBudgetCycle()) ?? null,
        []
    );

    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    const cycle = cycleResult ?? null;

    const stats = useMemo(
        () => (cycle ? computeBudgetStats(cycle, expenses, transfers, now) : null),
        [cycle, expenses, transfers, now]
    );

    return { cycle, stats, isLoading: cycleResult === undefined };
}