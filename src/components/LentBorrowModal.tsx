// src/components/LentBorrowModal.tsx
import React, { useEffect, useState } from 'react';
import { HandCoins, X, ArrowUpRight, ArrowDownLeft, Banknote, Wallet } from 'lucide-react';
import type { DebtDirection, PaymentSource } from '../types';
import { addDebt, getCounterparties } from '../db';
import { cn } from '../utils/cn';

interface LentBorrowModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
}

const SuggestionChips: React.FC<{
    options: string[];
    value: string;
    onSelect: (value: string) => void;
}> = ({ options, value, onSelect }) => {
    const q = value.trim().toLowerCase();
    const filtered = options
        .filter((opt) => {
            const lower = opt.toLowerCase();
            return q ? lower.includes(q) && lower !== q : true;
        })
        .slice(0, 6);

    if (filtered.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1.5 mt-2">
            {filtered.map((opt) => (
                <button
                    key={opt}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSelect(opt)}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                >
                    {opt}
                </button>
            ))}
        </div>
    );
};

export const LentBorrowModal: React.FC<LentBorrowModalProps> = ({
    isOpen,
    onClose,
    onSaved,
}) => {
    const [counterparty, setCounterparty] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [note, setNote] = useState('');
    const [direction, setDirection] = useState<DebtDirection>('OwedToMe');
    const [paidWith, setPaidWith] = useState<PaymentSource>('Cash');
    const [isSaving, setIsSaving] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        getCounterparties().then(setSuggestions);
    }, [isOpen]);

    if (!isOpen) return null;

    const amount = parseFloat(amountStr) || 0;
    const valid = counterparty.trim().length > 0 && amount > 0;

    const handleSave = async () => {
        if (!valid) return;
        setIsSaving(true);
        await addDebt({
            counterparty,
            direction,
            amountALL: amount,
            note: note.trim() || undefined,
            moveWalletWith: paidWith,
        });
        setIsSaving(false);
        setCounterparty('');
        setAmountStr('');
        setNote('');
        setDirection('OwedToMe');
        setPaidWith('Cash');
        onSaved();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl space-y-4 font-sans"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                            <HandCoins className="w-4 h-4 text-indigo-600" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900">Lend or Borrow Money</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setDirection('OwedToMe')}
                        className={cn(
                            'flex items-center justify-center gap-1.5 p-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer',
                            direction === 'OwedToMe'
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        )}
                    >
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                        I lent them
                    </button>
                    <button
                        type="button"
                        onClick={() => setDirection('iOwe')}
                        className={cn(
                            'flex items-center justify-center gap-1.5 p-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer',
                            direction === 'iOwe'
                                ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        )}
                    >
                        <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
                        They lent me
                    </button>
                </div>

                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Person Name
                    </p>
                    <input
                        type="text"
                        value={counterparty}
                        onChange={(e) => setCounterparty(e.target.value)}
                        placeholder="Name"
                        list="lekflow-counterparties-modal"
                        autoFocus
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                    <datalist id="lekflow-counterparties-modal">
                        {suggestions.map((s) => (
                            <option key={s} value={s} />
                        ))}
                    </datalist>
                    <SuggestionChips
                        options={suggestions}
                        value={counterparty}
                        onSelect={setCounterparty}
                    />
                </div>

                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Amount (Lek)
                    </p>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                </div>

                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Initial Payment Movement
                    </p>
                    <div className="inline-flex w-full p-1 rounded-2xl bg-slate-100 border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setPaidWith('Cash')}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                                paidWith === 'Cash'
                                    ? 'bg-white text-teal-700 font-bold shadow-xs'
                                    : 'text-slate-500 hover:text-slate-700'
                            )}
                        >
                            <Banknote className="w-3.5 h-3.5" />
                            Cash
                        </button>
                        <button
                            type="button"
                            onClick={() => setPaidWith('Card')}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                                paidWith === 'Card'
                                    ? 'bg-white text-rose-700 font-bold shadow-xs'
                                    : 'text-slate-500 hover:text-slate-700'
                            )}
                        >
                            <Wallet className="w-3.5 h-3.5" />
                            Bank
                        </button>
                    </div>
                </div>

                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Note (optional)
                    </p>
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Description..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold cursor-pointer hover:bg-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!valid || isSaving}
                        className="py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50 hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                        {isSaving ? 'Saving…' : 'Save Record'}
                    </button>
                </div>
            </div>
        </div>
    );
};