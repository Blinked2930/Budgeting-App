// src/components/BigExpensesCard.tsx
import React, { useMemo, useState } from 'react';
import { Plus, Landmark, TriangleAlert, CheckCircle2 } from 'lucide-react';
import type { BudgetCycle, ExpenseRecord } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { classifyExpense, budgetImpactOf, cycleStartMs } from '../utils/budget';
import { cn } from '../utils/cn';
import { LogBigExpenseModal } from './LogBigExpenseModal';

interface BigExpensesCardProps {
    cycle: BudgetCycle;
    expenses: ExpenseRecord[];
}

export const BigExpensesCard: React.FC<BigExpensesCardProps> = ({ cycle, expenses }) => {
    const { format } = useCurrency();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const planned = cycle.plannedBigExpensesALL ?? 0;

    // Only count big expenses logged in THIS cycle, using the same rule as the budget math.
    const paid = useMemo(() => {
        const startMs = cycleStartMs(cycle);
        return expenses
            .filter(
                (e) =>
                    !e.deleted &&
                    new Date(e.timestamp).getTime() >= startMs &&
                    classifyExpense(e) === 'big'
            )
            .reduce((sum, e) => sum + budgetImpactOf(e), 0);
    }, [expenses, cycle]);

    const remaining = Math.max(0, planned - paid);
    const paidPct = planned > 0 ? Math.min(100, (paid / planned) * 100) : 0;
    const overpaid = paid > planned;

    // Nothing to plan, nothing to show
    if (planned === 0 && paid === 0) {
        return null;
    }

    const status =
        planned === 0
            ? 'none'
            : overpaid
                ? 'over'
                : remaining === 0
                    ? 'done'
                    : paid > 0
                        ? 'partial'
                        : 'pending';

    return (
        <>
            <LogBigExpenseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                defaultAmount={remaining || planned}
                alreadyPaid={paid}
                plannedTotal={planned}
            />

            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-slate-500" />
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            Big Expenses
                        </p>
                    </div>
                    {status === 'done' && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" />
                            All paid
                        </span>
                    )}
                    {status === 'over' && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                            <TriangleAlert className="w-3 h-3" />
                            Over planned
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Planned</p>
                        <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{format(planned)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Paid</p>
                        <p className={cn(
                            'text-sm font-mono font-bold mt-0.5',
                            overpaid ? 'text-rose-600' : paid > 0 ? 'text-emerald-600' : 'text-slate-500'
                        )}>
                            {format(paid)}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Left</p>
                        <p className={cn(
                            'text-sm font-mono font-bold mt-0.5',
                            remaining === 0 ? 'text-emerald-600' : 'text-slate-900'
                        )}>
                            {format(remaining)}
                        </p>
                    </div>
                </div>

                {planned > 0 && (
                    <div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                                className={cn(
                                    'h-full rounded-full transition-all',
                                    overpaid ? 'bg-rose-500' : remaining === 0 ? 'bg-emerald-500' : 'bg-amber-500'
                                )}
                                style={{ width: `${paidPct}%` }}
                            />
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 mt-1.5">
                            {paidPct.toFixed(0)}% paid
                        </p>
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all shadow-sm"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Log Big Expense
                </button>
            </div>
        </>
    );
};