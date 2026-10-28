// src/components/LogBigExpenseModal.tsx
import React, { useState } from 'react';
import { X, TriangleAlert, Check } from 'lucide-react';
import { addExpense } from '../db';
import { useCurrency } from '../hooks/useCurrency';
import { CATEGORIES, type Category } from '../types';
import { dateToNoonISO, toDateInputValue } from '../utils/budget';
import { convertToALL } from '../utils/currency';
import { cn } from '../utils/cn';

interface LogBigExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultAmount: number;
    alreadyPaid: number;
    plannedTotal: number;
}

const inputClass =
    'w-full min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors';

export const LogBigExpenseModal: React.FC<LogBigExpenseModalProps> = ({
    isOpen,
    onClose,
    defaultAmount,
    alreadyPaid,
    plannedTotal,
}) => {
    const { format, currency } = useCurrency();
    const todayStr = toDateInputValue(new Date());

    // Pre-fill with whatever is left to pay
    const [amountStr, setAmountStr] = useState(String(Math.max(0, plannedTotal - alreadyPaid) || defaultAmount));
    const [label, setLabel] = useState('');
    const [category, setCategory] = useState<Category>('Utilities');
    const [dateOverride, setDateOverride] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const parsedAmount = parseFloat(amountStr) || 0;
    const normalizedALL = convertToALL(parsedAmount, currency);
    const newTotalPaid = alreadyPaid + normalizedALL;
    const overpaid = newTotalPaid > plannedTotal;
    const overpayAmount = newTotalPaid - plannedTotal;

    const handleSave = async () => {
        setError(null);
        if (parsedAmount <= 0) {
            setError('Enter an amount greater than zero.');
            return;
        }
        if (!label.trim()) {
            setError('Give this expense a label (e.g. "Rent").');
            return;
        }

        try {
            setIsSaving(true);
            const timestamp = dateOverride ? dateToNoonISO(dateOverride) : undefined;
            await addExpense({
                amount: parsedAmount,
                currency,
                category,
                itemName: label.trim(),
                isBigExpense: true,
                paidWith: 'Card',
                timestamp,
            });
            setAmountStr('');
            setLabel('');
            setIsSaving(false);
            onClose();
        } catch (err) {
            console.error('Failed to log big expense:', err);
            setError('Could not save. Please try again.');
            setIsSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900">Log Big Expense</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Label
                    </label>
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Rent, Utilities, Insurance…"
                        className={inputClass}
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Amount ({currency})
                        </label>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={amountStr}
                            onChange={(e) => setAmountStr(e.target.value)}
                            placeholder="0"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Category
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as Category)}
                            className={inputClass + ' appearance-none cursor-pointer'}
                        >
                            {CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Date
                    </label>
                    <div className="flex items-center gap-2">
                        {dateOverride && (
                            <button
                                type="button"
                                onClick={() => setDateOverride(null)}
                                className="text-[11px] text-emerald-600 hover:underline cursor-pointer"
                            >
                                Today
                            </button>
                        )}
                        <input
                            type="date"
                            value={dateOverride ?? todayStr}
                            max={todayStr}
                            onChange={(e) => {
                                const v = e.target.value;
                                setDateOverride(v && v !== todayStr ? v : null);
                            }}
                            className={cn(
                                'w-full bg-slate-50 border rounded-xl px-2.5 py-2 text-xs font-mono focus:outline-none focus:bg-white',
                                dateOverride
                                    ? 'border-amber-400 text-amber-700'
                                    : 'border-slate-200 text-slate-600'
                            )}
                        />
                    </div>
                </div>

                {overpaid && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                        <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                            This will put you {format(overpayAmount)} over your planned big expenses. That extra will come out of your remaining cycle budget.
                        </span>
                    </div>
                )}

                {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

                <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold cursor-pointer hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                        <Check className="w-3.5 h-3.5" />
                        {isSaving ? 'Saving…' : 'Log it'}
                    </button>
                </div>
            </div>
        </div>
    );
};