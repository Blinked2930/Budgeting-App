// src/components/AuditPanel.tsx
import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { useExpenses } from '../hooks/useExpenses';
import { useBudgetCycle } from '../hooks/useBudgetCycle';
import { useCurrency } from '../hooks/useCurrency';
import { totalOutflow, spendAgainstBudget, cashFlow } from '../utils/insights';

interface AuditPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AuditPanel: React.FC<AuditPanelProps> = ({ isOpen, onClose }) => {
    const { expenses } = useExpenses();
    const { stats, cycle } = useBudgetCycle();
    const { format } = useCurrency();

    const buckets = useMemo(() => {
        const regular: typeof expenses = [];
        const big: typeof expenses = [];
        const loanOrigins: typeof expenses = [];
        const loanRepayments: typeof expenses = [];
        const walletNeutral: typeof expenses = [];
        const income: typeof expenses = [];
        const deleted: typeof expenses = [];

        for (const e of expenses) {
            if (e.deleted) { deleted.push(e); continue; }
            if (e.walletNeutral) { walletNeutral.push(e); continue; }
            if (e.isBigExpense) { big.push(e); continue; }
            if (e.isDebtOrigin) { loanOrigins.push(e); continue; }
            if (e.debtRelated) { loanRepayments.push(e); continue; }
            if (e.amount < 0) { income.push(e); continue; }
            regular.push(e);
        }
        return { regular, big, loanOrigins, loanRepayments, walletNeutral, income, deleted };
    }, [expenses]);

    const sum = (arr: typeof expenses) =>
        arr.reduce((s, e) => s + Math.abs(e.amountInALL), 0);

    const outflow = totalOutflow(expenses);
    const budgeted = spendAgainstBudget(expenses);
    const flow = cashFlow(expenses);

    const Row: React.FC<{ label: string; value: string; hint?: string; bold?: boolean }> = ({ label, value, hint, bold }) => (
        <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
            <div className="min-w-0">
                <p className={`text-xs ${bold ? 'font-bold' : 'font-semibold'} text-slate-700`}>{label}</p>
                {hint && <p className="text-[10px] text-slate-400 leading-tight">{hint}</p>}
            </div>
            <p className={`text-xs font-mono ${bold ? 'font-bold' : 'font-bold'} text-slate-900 shrink-0`}>{value}</p>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-5 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900">📊 Audit</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {cycle && stats ? (
                    <>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cycle</p>
                            <Row label="Stipend" value={format(cycle.stipendAmountALL)} />
                            <Row label="+ Buffer Pool" value={format(cycle.bufferPoolALL)} hint="Unspent from previous cycle" />
                            <Row label="- Planned Big Expenses" value={format(cycle.plannedBigExpensesALL ?? 0)} hint="Pre-budgeted rent, bills" />
                            <Row label="= Cycle Budget" value={format(stats.cycleBudget)} bold />
                            <div className="h-2" />
                            <Row label="- Regular Spent" value={format(stats.spent)} hint="Food, transport, etc. (excludes rent)" />
                            <Row label="= Remaining" value={format(stats.remaining)} bold />
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Big Expenses (Paid)</p>
                            <Row label="Big Expense Spent" value={format(stats.bigExpenseSpent)} hint="Rent already logged this cycle" />
                            <Row label="Already subtracted from Cycle Budget" value={format(cycle.plannedBigExpensesALL ?? 0)} hint="Pre-budgeted amount" />
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Wallet</p>
                            <Row label="Bank (estimated)" value={format(stats.estimatedBankBalance)} />
                            <Row label="Cash (estimated)" value={format(stats.estimatedCashBalance)} />
                            <Row label="= Total wallet" value={format(stats.estimatedTotalBalance)} bold />
                            <Row label="+ Debts owed to you" value={format(stats.receivablesALL)} />
                            <Row label="- Debts you owe" value={format(stats.payablesALL)} />
                            <Row label="= Net worth" value={format(stats.netWorthALL)} bold />
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Expense buckets</p>
                            <Row label={`Regular expenses (${buckets.regular.length})`} value={format(sum(buckets.regular))} hint="What Insights category breakdown shows" />
                            <Row label={`Big Expenses (${buckets.big.length})`} value={format(sum(buckets.big))} hint="Rent, utilities you logged" />
                            <Row label={`Loan origins (${buckets.loanOrigins.length})`} value={format(sum(buckets.loanOrigins))} hint="Lent out or borrowed" />
                            <Row label={`Loan repayments (${buckets.loanRepayments.length})`} value={format(sum(buckets.loanRepayments))} hint="Money in or out from settling" />
                            <Row label={`Wallet neutral (${buckets.walletNeutral.length})`} value={format(sum(buckets.walletNeutral))} hint="Gifts, offsets — no wallet impact" />
                            <Row label={`Income (${buckets.income.length})`} value={format(sum(buckets.income))} hint="Repayments received, refunds" />
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Computed totals</p>
                            <Row label="Total Outflow" value={format(outflow)} hint="Every penny that left your pocket" />
                            <Row label="Budgeted Spend" value={format(budgeted)} hint="Regular spending (matches Budget tab)" />
                            <Row label="Cash Flow In" value={format(flow.inALL)} hint="Loans received / repayments" />
                            <Row label="Cash Flow Out" value={format(flow.outALL)} hint="Loans given / repayments" />
                            <Row label="Cash Flow Net" value={format(flow.netALL)} />
                        </div>
                    </>
                ) : (
                    <p className="text-xs text-slate-500">No cycle set up yet.</p>
                )}
            </div>
        </div>
    );
};