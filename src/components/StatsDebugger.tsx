// src/components/StatsDebugger.tsx
import React from 'react';
import { useExpenses } from '../hooks/useExpenses';
import { useBudgetCycle } from '../hooks/useBudgetCycle';

export const StatsDebugger: React.FC = () => {
    const { expenses } = useExpenses();
    const { cycle, stats } = useBudgetCycle();

    if (!cycle || !stats) return <p className="p-4">No cycle.</p>;

    const start = new Date(cycle.startDate).getTime();
    const startOfDay = new Date(start);
    startOfDay.setHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();

    let manualSpent = 0;
    let manualBig = 0;
    let manualSpentToday = 0;
    let manualSpentBeforeToday = 0;
    let manualCardSpent = 0;
    let manualCashSpent = 0;
    const included: { name: string; amount: number; isBig: boolean; when: string }[] = [];
    const excludedPreCycle: { name: string; amount: number; when: string }[] = [];
    const excludedDebtRelated: { name: string; amount: number }[] = [];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    for (const e of expenses) {
        if (e.deleted) continue;
        const whenMs = new Date(e.timestamp).getTime();
        if (whenMs < startMs) {
            excludedPreCycle.push({ name: e.itemName || '', amount: e.amountInALL, when: e.timestamp });
            continue;
        }

        if (!e.walletNeutral) {
            if (e.paidWith === 'Cash') manualCashSpent += e.amountInALL;
            else manualCardSpent += e.amountInALL;
        }

        if (e.debtRelated) {
            excludedDebtRelated.push({ name: e.itemName || '', amount: e.amountInALL });
            continue;
        }

        const budgetImpact = e.budgetAmountALL ?? e.amountInALL;

        if (e.category === 'Travel') continue;

        if (e.isBigExpense) {
            manualBig += budgetImpact;
            included.push({ name: e.itemName || '(no name)', amount: budgetImpact, isBig: true, when: e.timestamp });
            continue;
        }

        manualSpent += budgetImpact;
        included.push({ name: e.itemName || '(no name)', amount: budgetImpact, isBig: false, when: e.timestamp });

        if (whenMs >= todayMs) {
            manualSpentToday += budgetImpact;
        } else {
            manualSpentBeforeToday += budgetImpact;
        }
    }

    return (
        <div className="w-full max-w-md mx-auto px-4 py-4 space-y-4 font-mono text-xs">
            <h1 className="text-base font-bold">🔍 Debug</h1>

            <div className="bg-white p-3 rounded-xl border space-y-1">
                <p><b>Cycle:</b> {cycle.startDate} → {cycle.targetEndDate}</p>
                <p><b>Stipend:</b> {cycle.stipendAmountALL}</p>
                <p><b>Planned Big:</b> {cycle.plannedBigExpensesALL ?? 0}</p>
                <p><b>Buffer:</b> {cycle.bufferPoolALL}</p>
                <p><b>Starting Bank:</b> {cycle.startingRaiffeisenBalanceALL}</p>
                <p><b>Starting Cash:</b> {cycle.startingCashALL ?? 0}</p>
            </div>

            <div className="bg-white p-3 rounded-xl border space-y-1">
                <p><b>computeBudgetStats says:</b></p>
                <p>cycleBudget: {stats.cycleBudget}</p>
                <p>spent: <span className="text-rose-600 font-bold">{stats.spent}</span></p>
                <p>bigExpenseSpent: {stats.bigExpenseSpent}</p>
                <p>spentToday: {stats.spentToday}</p>
                <p>remaining: {stats.remaining}</p>
                <p>estimatedBankBalance: {stats.estimatedBankBalance}</p>
                <p>estimatedCashBalance: {stats.estimatedCashBalance}</p>
            </div>

            <div className="bg-white p-3 rounded-xl border space-y-1">
                <p><b>Manual re-computation:</b></p>
                <p>manualSpent (regular): <span className="text-rose-600 font-bold">{manualSpent}</span></p>
                <p>manualBig: {manualBig}</p>
                <p>manualSpentToday: {manualSpentToday}</p>
                <p>manualSpentBeforeToday: {manualSpentBeforeToday}</p>
                <p>manualCardSpent: {manualCardSpent}</p>
                <p>manualCashSpent: {manualCashSpent}</p>
            </div>

            <div className="bg-white p-3 rounded-xl border space-y-1">
                <p><b>Included ({included.length}):</b></p>
                {included.map((i, idx) => (
                    <p key={idx}>
                        {i.when.slice(0, 10)} · {i.name} · {i.amount}
                        {i.isBig ? ' [BIG]' : ''}
                    </p>
                ))}
            </div>

            <div className="bg-white p-3 rounded-xl border space-y-1">
                <p><b>Excluded pre-cycle ({excludedPreCycle.length}):</b></p>
                {excludedPreCycle.map((i, idx) => (
                    <p key={idx}>{i.when.slice(0, 10)} · {i.name || '(no name)'} · {i.amount}</p>
                ))}
            </div>

            <div className="bg-white p-3 rounded-xl border space-y-1">
                <p><b>Excluded debt-related ({excludedDebtRelated.length}):</b></p>
                {excludedDebtRelated.map((i, idx) => (
                    <p key={idx}>{i.name || '(no name)'} · {i.amount}</p>
                ))}
            </div>

            <p className="text-[10px] text-slate-500">
                If manualSpent ≠ stats.spent, computeBudgetStats has a bug. If they match but don't match your expectation, it's a data problem (duplicate entries, wrong category, etc).
            </p>
        </div>
    );
};