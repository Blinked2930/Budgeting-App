// src/components/DebtsPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
    X,
    Plus,
    HandCoins,
    ArrowUpRight,
    ArrowDownLeft,
    Banknote,
    Wallet,
    Check,
    ChevronDown,
    Trash2,
} from 'lucide-react';
import { useDebts } from '../hooks/useDebts';
import {
    addDebt,
    settleDebtCash,
    settleDebtNonCash,
    writeOffDebt,
    deleteDebt,
    getCounterparties,
} from '../db';
import { formatCurrency } from '../utils/currency';
import { cn } from '../utils/cn';
import type { DebtDirection, DebtRecord, PaymentSource } from '../types';

interface DebtsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

interface CounterpartyGroup {
    key: string;
    name: string;
    openDebts: DebtRecord[];
    resolvedDebts: DebtRecord[];
    receivables: number;
    payables: number;
}

const NewDebtForm: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
    const [counterparty, setCounterparty] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [note, setNote] = useState('');
    const [direction, setDirection] = useState<DebtDirection>('OwedToMe');
    const [paidWith, setPaidWith] = useState<PaymentSource>('Cash');
    const [isSaving, setIsSaving] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    useEffect(() => {
        getCounterparties().then(setSuggestions);
    }, []);

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
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-indigo-200 space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => setDirection('OwedToMe')}
                    className={cn(
                        'flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer',
                        direction === 'OwedToMe'
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                            : 'bg-white border-slate-200 text-slate-500'
                    )}
                >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    I lent
                </button>
                <button
                    type="button"
                    onClick={() => setDirection('iOwe')}
                    className={cn(
                        'flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer',
                        direction === 'iOwe'
                            ? 'bg-rose-50 border-rose-500 text-rose-700'
                            : 'bg-white border-slate-200 text-slate-500'
                    )}
                >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    They lent
                </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <input
                    type="text"
                    value={counterparty}
                    onChange={(e) => setCounterparty(e.target.value)}
                    placeholder="Person"
                    list="lekflow-counterparties-panel"
                    className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
                <datalist id="lekflow-counterparties-panel">
                    {suggestions.map((s) => (
                        <option key={s} value={s} />
                    ))}
                </datalist>
                <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="Amount (L)"
                    className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
            </div>

            <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Money moved via
                </p>
                <div className="inline-flex w-full p-1 rounded-2xl bg-white border border-slate-200">
                    <button
                        type="button"
                        onClick={() => setPaidWith('Cash')}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer',
                            paidWith === 'Cash'
                                ? 'bg-teal-50 text-teal-700'
                                : 'text-slate-400'
                        )}
                    >
                        <Banknote className="w-3 h-3" />
                        Cash
                    </button>
                    <button
                        type="button"
                        onClick={() => setPaidWith('Card')}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer',
                            paidWith === 'Card'
                                ? 'bg-rose-50 text-rose-700'
                                : 'text-slate-400'
                        )}
                    >
                        <Wallet className="w-3 h-3" />
                        Bank
                    </button>
                </div>
            </div>

            <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />

            <button
                type="button"
                onClick={handleSave}
                disabled={!valid || isSaving}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50 hover:bg-indigo-700 transition-colors"
            >
                {isSaving ? 'Saving…' : 'Save debt'}
            </button>
        </div>
    );
};

const DebtRow: React.FC<{ debt: DebtRecord }> = ({ debt }) => {
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [amountStr, setAmountStr] = useState<string>(String(debt.remainingALL));

    useEffect(() => {
        setAmountStr(String(debt.remainingALL));
    }, [debt.remainingALL]);

    const owedToMe = debt.direction === 'OwedToMe';
    const parsed = parseFloat(amountStr);
    const requested = Number.isNaN(parsed) ? debt.remainingALL : parsed;
    const clamped = Math.min(Math.max(requested, 0), debt.remainingALL);
    const isPartial = clamped > 0 && clamped < debt.remainingALL;
    const isValid = clamped > 0;

    const handleCash = async (paidWith: PaymentSource) => {
        if (!isValid) return;
        setBusyAction('cash-' + paidWith);
        await settleDebtCash(debt.id, clamped, paidWith);
        setBusyAction(null);
    };

    const handleNonCash = async (paidWith: PaymentSource) => {
        if (!isValid) return;
        setBusyAction('noncash-' + paidWith);
        await settleDebtNonCash(debt.id, clamped, paidWith);
        setBusyAction(null);
    };

    const handleWriteOff = async () => {
        setBusyAction('writeoff');
        await writeOffDebt(debt.id);
        setBusyAction(null);
    };

    const handleDelete = async () => {
        setBusyAction('delete');
        await deleteDebt(debt.id);
        setBusyAction(null);
    };

    return (
        <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
                <span
                    className={cn(
                        'text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1',
                        owedToMe ? 'text-emerald-600' : 'text-rose-500'
                    )}
                >
                    {owedToMe ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                    {owedToMe ? 'Owes you' : 'You owe'}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-slate-900">
                        {formatCurrency(debt.remainingALL, 'ALL')}
                    </span>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={busyAction !== null}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete debt (undoes cash/bank effect)"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {debt.note && <p className="text-[11px] text-slate-500 italic">{debt.note}</p>}

            <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Amount to settle
                    </p>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        placeholder="0"
                        className="w-full min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
                    />
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 pt-4">
                    {isPartial ? (
                        <span className="text-[10px] font-semibold text-amber-600">
                            Partial · {formatCurrency(clamped, 'ALL')}
                        </span>
                    ) : (
                        <span className="text-[10px] font-semibold text-emerald-600">
                            Full settlement
                        </span>
                    )}
                    {requested !== debt.remainingALL && (
                        <button
                            type="button"
                            onClick={() => setAmountStr(String(debt.remainingALL))}
                            className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {owedToMe ? (
                <div className="grid grid-cols-4 gap-1">
                    <button
                        type="button"
                        onClick={() => handleCash('Cash')}
                        disabled={busyAction !== null || !isValid}
                        className="py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 border border-teal-200"
                    >
                        <Banknote className="w-3 h-3" />
                        Got cash
                    </button>
                    <button
                        type="button"
                        onClick={() => handleCash('Card')}
                        disabled={busyAction !== null || !isValid}
                        className="py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 border border-rose-200"
                    >
                        <Wallet className="w-3 h-3" />
                        Got bank
                    </button>
                    <button
                        type="button"
                        onClick={() => handleNonCash('Cash')}
                        disabled={busyAction !== null || !isValid}
                        className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-slate-200"
                        title="They gave me something instead of cash. Hits budget, no wallet change."
                    >
                        They offset
                    </button>
                    <button
                        type="button"
                        onClick={handleWriteOff}
                        disabled={busyAction !== null}
                        className="py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-amber-200"
                        title="Forgive the debt — becomes a gift you gave"
                    >
                        Write off
                    </button>
                </div>
            ) : (
                <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-1">
                        <button
                            type="button"
                            onClick={() => handleCash('Cash')}
                            disabled={busyAction !== null || !isValid}
                            className="py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 border border-rose-200"
                        >
                            <Banknote className="w-3 h-3" />
                            Paid cash
                        </button>
                        <button
                            type="button"
                            onClick={() => handleCash('Card')}
                            disabled={busyAction !== null || !isValid}
                            className="py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 border border-rose-200"
                        >
                            <Wallet className="w-3 h-3" />
                            Paid bank
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        <button
                            type="button"
                            onClick={() => handleNonCash('Cash')}
                            disabled={busyAction !== null || !isValid}
                            className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-slate-200"
                            title="I bought them something with cash. Hits wallet only."
                        >
                            Offset cash
                        </button>
                        <button
                            type="button"
                            onClick={() => handleNonCash('Card')}
                            disabled={busyAction !== null || !isValid}
                            className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-slate-200"
                            title="I bought them something with card. Hits wallet only."
                        >
                            Offset card
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleWriteOff}
                        disabled={busyAction !== null}
                        className="w-full py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-amber-200"
                        title="They forgave me — clears the debt, nothing moves"
                    >
                        Forgiven
                    </button>
                </div>
            )}
        </div>
    );
};

const ResolvedDebtRow: React.FC<{ debt: DebtRecord }> = ({ debt }) => {
    const [busy, setBusy] = useState(false);
    const owedToMe = debt.direction === 'OwedToMe';

    const handleDelete = async () => {
        setBusy(true);
        await deleteDebt(debt.id);
        setBusy(false);
    };

    return (
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
                <p
                    className={cn(
                        'text-[11px] font-medium truncate line-through',
                        owedToMe ? 'text-emerald-600/60' : 'text-rose-500/60'
                    )}
                >
                    {owedToMe ? 'Owes you' : 'You owe'} {formatCurrency(debt.amountALL, 'ALL')}
                </p>
                {debt.note && (
                    <p className="text-[10px] text-slate-400 italic truncate line-through">
                        {debt.note}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Check className="w-3.5 h-3.5 text-slate-400" />
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={busy}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                    title="Delete resolved debt (undoes all effects)"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
};

export const DebtsPanel: React.FC<DebtsPanelProps> = ({ isOpen, onClose }) => {
    const { debts } = useDebts();
    const [showNewForm, setShowNewForm] = useState(false);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    const groups = useMemo<CounterpartyGroup[]>(() => {
        const map = new Map<string, CounterpartyGroup>();
        for (const d of debts) {
            let g = map.get(d.counterpartyKey);
            if (!g) {
                g = {
                    key: d.counterpartyKey,
                    name: d.counterparty,
                    openDebts: [],
                    resolvedDebts: [],
                    receivables: 0,
                    payables: 0,
                };
                map.set(d.counterpartyKey, g);
            }
            if (d.status === 'open') {
                g.openDebts.push(d);
                if (d.direction === 'OwedToMe') g.receivables += d.remainingALL;
                else g.payables += d.remainingALL;
            } else {
                g.resolvedDebts.push(d);
            }
        }
        return Array.from(map.values()).sort((a, b) => {
            const aTotal = a.receivables + a.payables;
            const bTotal = b.receivables + b.payables;
            if (aTotal !== bTotal) return bTotal - aTotal;
            return a.name.localeCompare(b.name);
        });
    }, [debts]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md max-h-[90vh] flex flex-col bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                            <HandCoins className="w-4 h-4 text-indigo-600" />
                        </div>
                        <h2 className="text-base font-bold text-slate-900">Debts</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto px-5 py-4 space-y-3">
                    <button
                        type="button"
                        onClick={() => setShowNewForm((v) => !v)}
                        className={cn(
                            'w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border text-xs font-bold transition-colors cursor-pointer',
                            showNewForm
                                ? 'bg-slate-50 border-slate-200 text-slate-500'
                                : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700'
                        )}
                    >
                        {showNewForm ? (
                            <>
                                <X className="w-3.5 h-3.5" />
                                Cancel
                            </>
                        ) : (
                            <>
                                <Plus className="w-3.5 h-3.5" />
                                New debt
                            </>
                        )}
                    </button>

                    {showNewForm && <NewDebtForm onSaved={() => setShowNewForm(false)} />}

                    {groups.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-500">
                            No debts yet. Tap "New debt" to add one.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {groups.map((g) => {
                                const isExpanded = expandedKey === g.key;
                                const net = g.receivables - g.payables;
                                const itemCount = g.openDebts.length + g.resolvedDebts.length;
                                const hasOpen = g.openDebts.length > 0;

                                return (
                                    <div
                                        key={g.key}
                                        className={cn(
                                            'rounded-2xl border transition-colors overflow-hidden',
                                            hasOpen
                                                ? 'bg-white border-slate-200'
                                                : 'bg-slate-50 border-slate-200'
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setExpandedKey(isExpanded ? null : g.key)}
                                            className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div
                                                    className={cn(
                                                        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                                                        hasOpen
                                                            ? 'bg-indigo-50 border border-indigo-200'
                                                            : 'bg-slate-100 border border-slate-200'
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            'text-xs font-bold',
                                                            hasOpen ? 'text-indigo-700' : 'text-slate-500'
                                                        )}
                                                    >
                                                        {g.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 text-left">
                                                    <p
                                                        className={cn(
                                                            'text-xs font-semibold truncate',
                                                            hasOpen ? 'text-slate-900' : 'text-slate-500'
                                                        )}
                                                    >
                                                        {g.name}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500">
                                                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                                        {!hasOpen && ' · settled'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                <div className="text-right">
                                                    <p
                                                        className={cn(
                                                            'text-sm font-mono font-bold',
                                                            !hasOpen
                                                                ? 'text-slate-400'
                                                                : net > 0
                                                                    ? 'text-emerald-600'
                                                                    : net < 0
                                                                        ? 'text-rose-500'
                                                                        : 'text-slate-500'
                                                        )}
                                                    >
                                                        {hasOpen && net > 0 ? '+' : ''}
                                                        {formatCurrency(Math.abs(net), 'ALL')}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500">
                                                        {!hasOpen
                                                            ? 'settled'
                                                            : net > 0
                                                                ? 'owes you'
                                                                : net < 0
                                                                    ? 'you owe'
                                                                    : 'even'}
                                                    </p>
                                                </div>
                                                <ChevronDown
                                                    className={cn(
                                                        'w-4 h-4 text-slate-400 transition-transform',
                                                        isExpanded && 'rotate-180'
                                                    )}
                                                />
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="px-3 pb-3 space-y-2 border-t border-slate-200 pt-3">
                                                {g.openDebts.map((d) => (
                                                    <DebtRow key={d.id} debt={d} />
                                                ))}

                                                {g.resolvedDebts.length > 0 && (
                                                    <>
                                                        {g.openDebts.length > 0 && (
                                                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pt-1">
                                                                Resolved
                                                            </p>
                                                        )}
                                                        {g.resolvedDebts.map((d) => (
                                                            <ResolvedDebtRow key={d.id} debt={d} />
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};