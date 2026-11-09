// src/components/BigExpensesCard.tsx
import React, { useMemo, useState } from 'react';
import { Plus, Landmark, TriangleAlert, CheckCircle2, Pencil, X } from 'lucide-react';
import type { BudgetCycle, ExpenseRecord } from '../types';
import { saveBudgetCycle } from '../db';
import { useCurrency } from '../hooks/useCurrency';
import { classifyExpense, budgetImpactOf, cycleStartMs } from '../utils/budget';
import { cn } from '../utils/cn';
import { LogBigExpenseModal } from './LogBigExpenseModal';

interface BigExpensesCardProps {
    cycle: BudgetCycle;
    expenses: ExpenseRecord[];
}

const SetPlannedRentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    cycle: BudgetCycle;
}> = ({ isOpen, onClose, cycle }) => {
    const [amountStr, setAmountStr] = useState(String(cycle.plannedBigExpensesALL || ''));
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        const val = parseFloat(amountStr) || 0;
        setIsSaving(true);
        await saveBudgetCycle({
            ...cycle,
            plannedBigExpensesALL: val,
        });
        setIsSaving(false);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 animate-in fade-in font-sans"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
                            <Landmark className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">Planned Rent & Big Expenses</h3>
                            <p className="text-[10px] text-slate-400">Total budgeted for rent and fixed bills this cycle</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Amount (Lek)
                    </label>
                    <input
                        type="number"
                        inputMode="decimal"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        placeholder="e.g. 25000"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white"
                        autoFocus
                    />
                    <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                        This amount is held back from your daily budget allowance so your allowance won't overcount before you pay rent, and won't drop by -25,000 on rent day.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="py-2.5 rounded-2xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 cursor-pointer disabled:opacity-50"
                    >
                        {isSaving ? 'Saving…' : 'Save Plan'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const BigExpensesCard: React.FC<BigExpensesCardProps> = ({ cycle, expenses }) => {
    const { format } = useCurrency();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditPlannedOpen, setIsEditPlannedOpen] = useState(false);

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

    if (planned === 0 && paid === 0) {
        return (
            <>
                <SetPlannedRentModal
                    isOpen={isEditPlannedOpen}
                    onClose={() => setIsEditPlannedOpen(false)}
                    cycle={cycle}
                />
                <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3 font-sans">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Landmark className="w-3.5 h-3.5 text-slate-500" />
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                Rent & Fixed Big Expenses
                            </p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Planning rent or monthly bills? Set your planned rent to hold it back from your daily allowance so you don't overspend before rent day or go negative when paying.
                    </p>
                    <button
                        type="button"
                        onClick={() => setIsEditPlannedOpen(true)}
                        className="w-full py-2.5 rounded-2xl bg-slate-50 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 hover:border-purple-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all"
                    >
                        <Plus className="w-3.5 h-3.5 text-purple-600" />
                        Set Planned Rent / Big Expenses
                    </button>
                </div>
            </>
        );
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
            <SetPlannedRentModal
                isOpen={isEditPlannedOpen}
                onClose={() => setIsEditPlannedOpen(false)}
                cycle={cycle}
            />
            <LogBigExpenseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                defaultAmount={remaining || planned}
                alreadyPaid={paid}
                plannedTotal={planned}
            />

            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3 font-sans">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-slate-500" />
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            Rent & Big Expenses
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
                        <div className="flex items-center gap-1">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Planned</p>
                            <button
                                type="button"
                                onClick={() => setIsEditPlannedOpen(true)}
                                className="text-slate-400 hover:text-purple-600 cursor-pointer"
                                title="Edit planned amount"
                            >
                                <Pencil className="w-2.5 h-2.5" />
                            </button>
                        </div>
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
                    Log Big Expense (Rent)
                </button>
            </div>
        </>
    );
};