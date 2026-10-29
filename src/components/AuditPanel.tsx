// src/components/AuditPanel.tsx
import React, { useMemo, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { ExpenseRecord } from '../types';
import { useExpenses } from '../hooks/useExpenses';
import { useBudgetCycle } from '../hooks/useBudgetCycle';
import { useCurrency } from '../hooks/useCurrency';
import { cn } from '../utils/cn';
import { classifyExpense, budgetImpactOf, cycleStartMs } from '../utils/budget';
import type { ExpenseBucket } from '../utils/budget';

interface AuditPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const Row: React.FC<{
    label: string;
    value: string;
    hint?: string;
    bold?: boolean;
    color?: string;
}> = ({ label, value, hint, bold, color }) => (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
        <div className="min-w-0">
            <p className={cn('text-xs text-slate-700', bold ? 'font-bold' : 'font-semibold')}>{label}</p>
            {hint && <p className="text-[10px] text-slate-400 leading-tight">{hint}</p>}
        </div>
        <p className={cn('text-xs font-mono font-bold shrink-0', color ?? 'text-slate-900')}>{value}</p>
    </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{children}</p>
);

const EMPTY_BUCKETS = (): Record<ExpenseBucket, ExpenseRecord[]> => ({
    reconciliation: [],
    debtSettlement: [],
    debtOrigin: [],
    forgiveness: [],
    walletNeutral: [],
    travel: [],
    big: [],
    regular: [],
});

const flagsOf = (e: ExpenseRecord): string => {
    const flags: string[] = [];
    if (e.debtRelated) flags.push('debtRelated');
    if (e.isDebtOrigin) flags.push('isDebtOrigin');
    if (e.walletNeutral) flags.push('walletNeutral');
    if (e.isBigExpense) flags.push('isBigExpense');
    if (e.isForgiveness) flags.push('isForgiveness');
    if (e.budgetAmountALL !== undefined) flags.push(`budgetAmountALL=${Math.round(e.budgetAmountALL)}`);
    return flags.length ? flags.join(',') : 'none';
};

export const AuditPanel: React.FC<AuditPanelProps> = ({ isOpen, onClose }) => {
    const { expenses } = useExpenses();
    const { stats, cycle } = useBudgetCycle();
    const { format } = useCurrency();
    const [copied, setCopied] = useState(false);

    // Same filters computeBudgetStats applies: not deleted, on/after local-midnight cycle start.
    const inCycle = useMemo(() => {
        const startMs = cycle ? cycleStartMs(cycle) : 0;
        return expenses
            .filter((e) => !e.deleted && (!cycle || new Date(e.timestamp).getTime() >= startMs))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }, [expenses, cycle]);

    const buckets = useMemo(() => {
        const b = EMPTY_BUCKETS();
        for (const e of inCycle) b[classifyExpense(e)].push(e);
        return b;
    }, [inCycle]);

    // Spending buckets: measured by budget impact (what computeBudgetStats uses).
    const sumBudget = (arr: ExpenseRecord[]) => arr.reduce((s, e) => s + budgetImpactOf(e), 0);
    // Wallet buckets: signed amount, positive = money out, negative = money in.
    const sumOut = (arr: ExpenseRecord[]) => arr.reduce((s, e) => s + e.amountInALL, 0);

    const regularSpend = buckets.regular.filter((e) => e.amount >= 0);
    const refunds = buckets.regular.filter((e) => e.amount < 0);

    const consumedIdentity = stats
        ? stats.consumed - (sumBudget(buckets.regular) + sumBudget(buckets.forgiveness))
        : 0;
    const bigIdentity = stats ? stats.bigExpenseSpent - sumBudget(buckets.big) : 0;
    const travelIdentity = stats ? stats.travelSpent - sumBudget(buckets.travel) : 0;

    // Independent wallet recomputation: start balances + stipend - every wallet-moving entry.
    // (Bank<->Cash transfers net to zero in the total, so they are not needed here.)
    const walletIdentity = useMemo(() => {
        if (!stats || !cycle) return 0;
        const movedOut = inCycle
            .filter((e) => !e.walletNeutral)
            .reduce((s, e) => s + e.amountInALL, 0);
        const expected =
            cycle.startingRaiffeisenBalanceALL +
            (cycle.startingCashALL ?? 0) +
            cycle.stipendAmountALL -
            movedOut;
        return stats.walletTotal - expected;
    }, [stats, cycle, inCycle]);

    const ok = (n: number) => Math.abs(n) < 2;
    const checkText = (n: number) => (ok(n) ? '✅ Match' : `❌ Off by ${format(Math.abs(n))}`);

    const handleCopy = () => {
        if (!stats || !cycle) return;

        const L: string[] = [];
        const n = (v: number) => String(Math.round(v));

        L.push('=== LEKFLOW AUDIT REPORT ===');
        L.push(`Cycle: ${cycle.startDate} → ${cycle.targetEndDate}`);
        L.push('All numbers below in ALL (Lekë) unless formatted otherwise.');
        L.push('');
        L.push('--- FREE TO SPEND (Remaining) ---');
        L.push(`Wallet total: ${n(stats.walletTotal)}`);
        L.push(`- Unpaid big expenses: ${n(stats.unpaidBig)}  (planned ${n(stats.plannedBig)}, paid ${n(stats.bigExpenseSpent)})`);
        L.push(`- You owe: ${n(stats.payablesALL)}`);
        L.push(`- Travel stash held back: ${n(stats.travelStashHeld)}`);
        L.push(`= Free to spend: ${n(stats.freeToSpend)}`);
        L.push(`+ Consumed so far: ${n(stats.consumed)}`);
        L.push(`= Cycle budget: ${n(stats.cycleBudget)}`);
        L.push(`Stipend: ${n(cycle.stipendAmountALL)}  Planned big: ${n(cycle.plannedBigExpensesALL ?? 0)}`);
        L.push('');
        L.push('--- WALLET VIEW ---');
        L.push(`Start bank: ${n(cycle.startingRaiffeisenBalanceALL)}  Start cash: ${n(cycle.startingCashALL ?? 0)}`);
        L.push(`Bank (est): ${n(stats.estimatedBankBalance)}`);
        L.push(`Cash (est): ${n(stats.estimatedCashBalance)}`);
        L.push(`= Wallet total: ${n(stats.walletTotal)}`);
        L.push(`Travel stash balance (inside wallet): ${n(stats.travelStashBalance)}`);
        L.push(`+ Owed to you: ${n(stats.receivablesALL)}`);
        L.push(`- You owe: ${n(stats.payablesALL)}`);
        L.push(`= Net worth: ${n(stats.netWorthALL)}`);
        L.push('');
        L.push('--- BUCKETS (budget impact for spending buckets; wallet outflow, + = out / - = in, for the rest) ---');
        L.push(`Regular spending (${regularSpend.length}): ${n(sumBudget(regularSpend))}`);
        L.push(`Refunds counted against spending (${refunds.length}): ${n(sumBudget(refunds))}`);
        L.push(`Forgiven debts (${buckets.forgiveness.length}): ${n(sumBudget(buckets.forgiveness))}`);
        L.push(`Big expenses (${buckets.big.length}): ${n(sumBudget(buckets.big))}`);
        L.push(`Travel (${buckets.travel.length}): ${n(sumBudget(buckets.travel))}`);
        L.push(`Reconciliations (${buckets.reconciliation.length}): ${n(sumOut(buckets.reconciliation))}`);
        L.push(`Loan origins (${buckets.debtOrigin.length}): ${n(sumOut(buckets.debtOrigin))}`);
        L.push(`Loan settlements (${buckets.debtSettlement.length}): ${n(sumOut(buckets.debtSettlement))}`);
        L.push(`Other wallet-neutral (${buckets.walletNeutral.length}): ${n(sumOut(buckets.walletNeutral))}`);
        L.push('');
        L.push('--- IDENTITY CHECKS ---');
        L.push(`Consumed = regular + refunds + forgiven? ${ok(consumedIdentity) ? 'MATCH' : `OFF by ${n(consumedIdentity)}`}`);
        L.push(`Big spent = big bucket? ${ok(bigIdentity) ? 'MATCH' : `OFF by ${n(bigIdentity)}`}`);
        L.push(`Travel spent = travel bucket? ${ok(travelIdentity) ? 'MATCH' : `OFF by ${n(travelIdentity)}`}`);
        L.push(`Wallet = start + stipend - wallet-moving entries? ${ok(walletIdentity) ? 'MATCH' : `OFF by ${n(walletIdentity)}`}`);
        L.push('');
        L.push('--- ENTRIES THIS CYCLE ---');
        L.push('date | name | amountInALL | budgetImpact | category | paidWith | bucket | flags');
        for (const e of inCycle) {
            L.push(
                `${e.timestamp.slice(0, 10)} | ${e.itemName || '(no name)'} | ${n(e.amountInALL)} | ${n(budgetImpactOf(e))} | ${e.category} | ${e.paidWith ?? '?'} | ${classifyExpense(e)} | ${flagsOf(e)}`
            );
        }

        navigator.clipboard.writeText(L.join('\n')).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-5 space-y-4 select-text"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900">📊 Audit</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer text-xs font-semibold"
                        >
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Copied!' : 'Copy report'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {cycle && stats ? (
                    <>
                        <div>
                            <SectionTitle>Free to spend (Remaining)</SectionTitle>
                            <Row label="Wallet total" value={format(stats.walletTotal)} hint="Bank + cash, from your logged entries" />
                            <Row label="− Unpaid big expenses" value={format(stats.unpaidBig)} hint="Rent/bills planned but not yet logged as paid" />
                            <Row label="− You owe" value={format(stats.payablesALL)} hint="Open debts you will have to pay" />
                            <Row label="− Travel stash held back" value={format(stats.travelStashHeld)} hint="Earmarked money that sits inside your bank balance" />
                            <Row label="= Free to spend" value={format(stats.freeToSpend)} bold />
                            <Row label="+ Consumed so far" value={format(stats.consumed)} hint="Regular spending + forgiven debts" />
                            <Row label="= Cycle budget" value={format(stats.cycleBudget)} bold hint="Free to spend + spent. Drives your daily allowance" />
                        </div>

                        <div>
                            <SectionTitle>Wallet view</SectionTitle>
                            <Row label="Bank (estimated)" value={format(stats.estimatedBankBalance)} />
                            <Row label="Cash (estimated)" value={format(stats.estimatedCashBalance)} />
                            <Row label="= Wallet total" value={format(stats.walletTotal)} bold />
                            <Row label="Travel stash (inside wallet)" value={format(stats.travelStashBalance)} hint="Informational: already part of the wallet total" />
                            <Row label="+ Owed to you" value={format(stats.receivablesALL)} />
                            <Row label="- You owe" value={format(stats.payablesALL)} color="text-rose-600" />
                            <Row label="= Net worth" value={format(stats.netWorthALL)} bold />
                        </div>

                        <div>
                            <SectionTitle>Buckets (this cycle)</SectionTitle>
                            <Row label={`Regular spending (${regularSpend.length})`} value={format(sumBudget(regularSpend))} hint="Counted at budget impact (split bills use your share)" />
                            <Row label={`Refunds (${refunds.length})`} value={format(sumBudget(refunds))} hint="Negative entries that reduce spending" />
                            <Row label={`Forgiven debts (${buckets.forgiveness.length})`} value={format(sumBudget(buckets.forgiveness))} hint="Written off — counts as spending" />
                            <Row label={`Big expenses (${buckets.big.length})`} value={format(sumBudget(buckets.big))} hint="Rent etc. logged via Log Big Expense" />
                            <Row label={`Travel (${buckets.travel.length})`} value={format(sumBudget(buckets.travel))} hint="Paid from the travel stash" />
                            <Row label={`Reconciliations (${buckets.reconciliation.length})`} value={format(sumOut(buckets.reconciliation))} hint="Wallet corrections only. Negative = money added" />
                            <Row label={`Loan origins (${buckets.debtOrigin.length})`} value={format(sumOut(buckets.debtOrigin))} hint="Money lent (+) or borrowed (−)" />
                            <Row label={`Loan settlements (${buckets.debtSettlement.length})`} value={format(sumOut(buckets.debtSettlement))} hint="Repayments — not spending" />
                            <Row label={`Other wallet-neutral (${buckets.walletNeutral.length})`} value={format(sumOut(buckets.walletNeutral))} hint="Bookkeeping only, no money moved" />
                        </div>

                        <div>
                            <SectionTitle>Identity checks</SectionTitle>
                            <Row label="Consumed = regular + refunds + forgiven?" value={checkText(consumedIdentity)} hint="Should always be zero" />
                            <Row label="Big spent = big bucket?" value={checkText(bigIdentity)} hint="Should always be zero" />
                            <Row label="Travel spent = travel bucket?" value={checkText(travelIdentity)} hint="Should always be zero" />
                            <Row label="Wallet = start + stipend − wallet entries?" value={checkText(walletIdentity)} hint="Recomputed independently of the bank/cash split" />
                        </div>

                    </>
                ) : (
                    <p className="text-xs text-slate-500">No cycle set up yet.</p>
                )}
            </div>
        </div>
    );
};