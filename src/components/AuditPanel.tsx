// src/components/AuditPanel.tsx
import React, { useMemo, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useExpenses } from '../hooks/useExpenses';
import { useBudgetCycle } from '../hooks/useBudgetCycle';
import { useCurrency } from '../hooks/useCurrency';
import { cn } from '../utils/cn';

interface AuditPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AuditPanel: React.FC<AuditPanelProps> = ({ isOpen, onClose }) => {
    const { expenses } = useExpenses();
    const { stats, cycle } = useBudgetCycle();
    const { format } = useCurrency();
    const [copied, setCopied] = useState(false);

    const buckets = useMemo(() => {
        const regular: typeof expenses = [];
        const big: typeof expenses = [];
        const travel: typeof expenses = [];
        const loanOrigins: typeof expenses = [];
        const loanRepayments: typeof expenses = [];
        const forgiveness: typeof expenses = [];
        const walletNeutralOther: typeof expenses = [];
        const income: typeof expenses = [];

        const startMs = cycle ? new Date(cycle.startDate).getTime() : 0;

        for (const e of expenses) {
            if (e.deleted) continue;
            const whenMs = new Date(e.timestamp).getTime();
            if (cycle && whenMs < startMs) continue;

            if (e.isForgiveness) { forgiveness.push(e); continue; }
            if (e.walletNeutral) { walletNeutralOther.push(e); continue; }
            if (e.isBigExpense) { big.push(e); continue; }
            if (e.category === 'Travel') { travel.push(e); continue; }
            if (e.isDebtOrigin) { loanOrigins.push(e); continue; }
            if (e.debtRelated) { loanRepayments.push(e); continue; }
            if (e.amount < 0) { income.push(e); continue; }
            regular.push(e);
        }
        return { regular, big, travel, loanOrigins, loanRepayments, forgiveness, walletNeutralOther, income };
    }, [expenses, cycle]);

    const sum = (arr: typeof expenses) =>
        arr.reduce((s, e) => s + Math.abs(e.amountInALL), 0);

    const consumedIdentity = stats
        ? stats.consumed - (sum(buckets.regular) + sum(buckets.forgiveness))
        : 0;
    const bigIdentity = stats
        ? stats.bigExpenseSpent - sum(buckets.big)
        : 0;

    const handleCopy = () => {
        if (!stats || !cycle) return;

        const lines: string[] = [];
        lines.push('=== LEKFLOW AUDIT REPORT ===');
        lines.push(`Cycle: ${cycle.startDate} → ${cycle.targetEndDate}`);
        lines.push('');
        lines.push('--- BUDGET VIEW ---');
        lines.push(`Stipend: ${format(cycle.stipendAmountALL)}`);
        lines.push(`+ Buffer pool: ${format(cycle.bufferPoolALL)}`);
        lines.push(`- Planned big: ${format(cycle.plannedBigExpensesALL ?? 0)}`);
        lines.push(`= Cycle budget: ${format(stats.cycleBudget)}`);
        lines.push(`- Consumed: ${format(stats.consumed)}`);
        lines.push(`= Remaining: ${format(stats.remaining)}`);
        lines.push('');
        lines.push('--- WALLET VIEW ---');
        lines.push(`Bank (est): ${format(stats.estimatedBankBalance)}`);
        lines.push(`Cash (est): ${format(stats.estimatedCashBalance)}`);
        lines.push(`= Wallet total: ${format(stats.walletTotal)}`);
        lines.push(`+ Travel stash: ${format(stats.travelStashBalance)}`);
        lines.push(`+ Owed to you: ${format(stats.receivablesALL)}`);
        lines.push(`- You owe: ${format(stats.payablesALL)}`);
        lines.push(`= Net worth: ${format(stats.netWorthALL)}`);
        lines.push('');
        lines.push('--- EXPENSE BUCKETS ---');
        lines.push(`Regular (${buckets.regular.length}): ${format(sum(buckets.regular))}`);
        lines.push(`Forgiven (${buckets.forgiveness.length}): ${format(sum(buckets.forgiveness))}`);
        lines.push(`Big Expenses (${buckets.big.length}): ${format(sum(buckets.big))}`);
        lines.push(`Travel (${buckets.travel.length}): ${format(sum(buckets.travel))}`);
        lines.push(`Loans out/in (${buckets.loanOrigins.length}): ${format(sum(buckets.loanOrigins))}`);
        lines.push(`Loan settlements (${buckets.loanRepayments.length}): ${format(sum(buckets.loanRepayments))}`);
        lines.push(`Other wallet-neutral (${buckets.walletNeutralOther.length}): ${format(sum(buckets.walletNeutralOther))}`);
        lines.push(`Income (${buckets.income.length}): ${format(sum(buckets.income))}`);
        lines.push('');
        lines.push('--- IDENTITY CHECKS ---');
        lines.push(`Consumed = regular + forgiven? ${Math.abs(consumedIdentity) < 2 ? '✅ Match' : `❌ Off by ${format(Math.abs(consumedIdentity))}`}`);
        lines.push(`Big spent = big bucket? ${Math.abs(bigIdentity) < 2 ? '✅ Match' : `❌ Off by ${format(Math.abs(bigIdentity))}`}`);
        lines.push(`Wallet = bank + cash? ${Math.abs(stats.walletTotal - (stats.estimatedBankBalance + stats.estimatedCashBalance)) < 1 ? '✅ Match' : '❌ Mismatch'}`);

        navigator.clipboard.writeText(lines.join('\n')).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

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
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Budget view</p>
                            <Row label="Stipend" value={format(cycle.stipendAmountALL)} />
                            <Row label="+ Buffer pool" value={format(cycle.bufferPoolALL)} />
                            <Row label="- Planned big" value={format(cycle.plannedBigExpensesALL ?? 0)} hint="Rent/bills you pre-budgeted" />
                            <Row label="= Cycle budget" value={format(stats.cycleBudget)} bold />
                            <Row label="- Consumed" value={format(stats.consumed)} hint="Regular spending + forgiven gifts" />
                            <Row label="= Remaining to spend" value={format(stats.remaining)} bold />
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Wallet view</p>
                            <Row label="Bank (estimated)" value={format(stats.estimatedBankBalance)} />
                            <Row label="Cash (estimated)" value={format(stats.estimatedCashBalance)} />
                            <Row label="= Wallet total" value={format(stats.walletTotal)} bold />
                            <Row label="+ Travel stash" value={format(stats.travelStashBalance)} />
                            <Row label="+ Owed to you" value={format(stats.receivablesALL)} />
                            <Row label="- You owe" value={format(stats.payablesALL)} color="text-rose-600" />
                            <Row label="= Net worth" value={format(stats.netWorthALL)} bold />
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Expense buckets (this cycle)</p>
                            <Row label={`Regular (${buckets.regular.length})`} value={format(sum(buckets.regular))} hint="Food, coffee, transport, etc." />
                            <Row label={`Forgiven (${buckets.forgiveness.length})`} value={format(sum(buckets.forgiveness))} hint="Debts written off — counts as expense" />
                            <Row label={`Big Expenses (${buckets.big.length})`} value={format(sum(buckets.big))} hint="Rent logged via Log Big Expense" />
                            <Row label={`Travel (${buckets.travel.length})`} value={format(sum(buckets.travel))} hint="From travel stash" />
                            <Row label={`Loans out/in (${buckets.loanOrigins.length})`} value={format(sum(buckets.loanOrigins))} hint="Money lent or borrowed" />
                            <Row label={`Loan settlements (${buckets.loanRepayments.length})`} value={format(sum(buckets.loanRepayments))} hint="Repayments — not spending" />
                            <Row label={`Other wallet-neutral (${buckets.walletNeutralOther.length})`} value={format(sum(buckets.walletNeutralOther))} hint="Offsets without cash movement" />
                            <Row label={`Income (${buckets.income.length})`} value={format(sum(buckets.income))} hint="Refunds, money in" />
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Identity checks</p>
                            <Row
                                label="Consumed = regular + forgiven?"
                                value={Math.abs(consumedIdentity) < 2
                                    ? '✅ Match'
                                    : `❌ Off by ${format(Math.abs(consumedIdentity))}`}
                                hint="Should always be zero"
                            />
                            <Row
                                label="Big spent = big bucket?"
                                value={Math.abs(bigIdentity) < 2
                                    ? '✅ Match'
                                    : `❌ Off by ${format(Math.abs(bigIdentity))}`}
                                hint="Should always be zero"
                            />
                            <Row
                                label="Wallet = bank + cash?"
                                value={Math.abs(stats.walletTotal - (stats.estimatedBankBalance + stats.estimatedCashBalance)) < 1
                                    ? '✅ Match'
                                    : '❌ Mismatch'}
                                hint="Should always be zero"
                            />
                        </div>
                    </>
                ) : (
                    <p className="text-xs text-slate-500">No cycle set up yet.</p>
                )}
            </div>
        </div>
    );
};