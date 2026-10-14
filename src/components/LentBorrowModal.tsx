// src/components/LentBorrowModal.tsx
import React, { useEffect, useState } from 'react';
import { HandCoins, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import type { DebtDirection } from '../types';
import { addDebt, getCounterparties } from '../db';
import { cn } from '../utils/cn';

interface LentBorrowModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
}

export const LentBorrowModal: React.FC<LentBorrowModalProps> = ({
    isOpen,
    onClose,
    onSaved,
}) => {
    const [counterparty, setCounterparty] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [note, setNote] = useState('');
    const [direction, setDirection] = useState<DebtDirection>('OwedToMe');
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
        });
        setIsSaving(false);
        setCounterparty('');
        setAmountStr('');
        setNote('');
        setDirection('OwedToMe');
        onSaved();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center">
                            <HandCoins className="w-4 h-4 text-purple-400" />
                        </div>
                        <h3 className="text-base font-bold text-white">Lend or borrow</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setDirection('OwedToMe')}
                        className={cn(
                            'flex items-center justify-center gap-1.5 p-2.5 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer',
                            direction === 'OwedToMe'
                                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        )}
                    >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        I lent them
                    </button>
                    <button
                        type="button"
                        onClick={() => setDirection('iOwe')}
                        className={cn(
                            'flex items-center justify-center gap-1.5 p-2.5 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer',
                            direction === 'iOwe'
                                ? 'bg-rose-500/15 border-rose-500 text-rose-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        )}
                    >
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        They lent me
                    </button>
                </div>

                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Person
                    </p>
                    <input
                        type="text"
                        value={counterparty}
                        onChange={(e) => setCounterparty(e.target.value)}
                        placeholder="Alex"
                        list="lekflow-counterparties"
                        autoFocus
                        className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/70"
                    />
                    <datalist id="lekflow-counterparties">
                        {suggestions.map((s) => (
                            <option key={s} value={s} />
                        ))}
                    </datalist>
                </div>

                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Amount (L)
                    </p>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        placeholder="0"
                        className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/70"
                    />
                </div>

                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Note (optional)
                    </p>
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What's it for?"
                        className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/70"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!valid || isSaving}
                        className="py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-400 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                        {isSaving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};