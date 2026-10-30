// src/components/DebtsPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
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
    Pencil,
    Save,
    CheckCheck,
    TriangleAlert,
    Users,
} from 'lucide-react';
import { useDebts } from '../hooks/useDebts';
import {
    addDebt,
    settleDebtCash,
    settleDebtNonCash,
    writeOffDebt,
    deleteDebt,
    getCounterparties,
    updateDebt,
    hasLinkedExpenses,
} from '../db';
import { useCurrency } from '../hooks/useCurrency';
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

function formatDebtDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return iso;
    }
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

const ConfirmDialog: React.FC<{ state: ConfirmState | null; onClose: () => void }> = ({
  state,
  onClose,
}) => {
  if (!state || !state.isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
            <TriangleAlert className="w-5 h-5 text-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900">{state.title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{state.message}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className="py-3 rounded-2xl bg-rose-600 text-white text-xs font-bold cursor-pointer hover:bg-rose-700 transition-colors"
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

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

const DebtRow: React.FC<{ debt: DebtRecord; onDelete: (debt: DebtRecord) => void }> = ({ debt, onDelete }) => {
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [amountStr, setAmountStr] = useState<string>(String(debt.remainingALL));
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(debt.counterparty);
    const [editAmount, setEditAmount] = useState(String(debt.amountALL));
    const [editNote, setEditNote] = useState(debt.note || '');
    const { format } = useCurrency();

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

    const handleSaveEdit = async () => {
        setBusyAction('save');
        const newAmount = parseFloat(editAmount) || debt.amountALL;
        const newRemaining = newAmount - (debt.myShareAmountALL ?? 0);
        await updateDebt(debt.id, {
            counterparty: editName,
            amountALL: newAmount,
            remainingALL: newRemaining,
            note: editNote.trim() || undefined,
        });
        setBusyAction(null);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="p-3 rounded-xl bg-slate-50 border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Edit Debt</p>
                    <div className="flex gap-1">
                        <button onClick={() => setIsEditing(false)} className="p-1.5 rounded text-slate-400 hover:bg-slate-200 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                        <button onClick={handleSaveEdit} disabled={busyAction === 'save'} className="p-1.5 rounded text-emerald-600 hover:bg-emerald-100 cursor-pointer"><Save className="w-3.5 h-3.5" /></button>
                    </div>
                </div>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-500" />
                <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-500" />
                <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Note" className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
        );
    }

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
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-mono font-bold text-slate-900">
                        {format(debt.remainingALL)}
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                        title="Edit debt"
                    >
                        <Pencil className="w-3 h-3" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(debt)}
                        disabled={busyAction !== null}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete debt (undoes cash/bank effect)"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {debt.note && <p className="text-[11px] text-slate-500 italic">{debt.note}</p>}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                <span>Opened {formatDebtDate(debt.createdAt)}</span>
                {debt.resolvedAt && (
                    <span>· Resolved {formatDebtDate(debt.resolvedAt)}</span>
                )}
            </div>

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
                            Partial · {format(clamped)}
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

const ResolvedDebtRow: React.FC<{ debt: DebtRecord; onDelete: (debt: DebtRecord) => void }> = ({ debt, onDelete }) => {
    const owedToMe = debt.direction === 'OwedToMe';
    const { format } = useCurrency();

    return (
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
                <p
                    className={cn(
                        'text-[11px] font-medium truncate line-through',
                        owedToMe ? 'text-emerald-600/60' : 'text-rose-500/60'
                    )}
                >
                    {owedToMe ? 'Owes you' : 'You owe'} {format(debt.amountALL)}
                </p>
                {debt.note && (
                    <p className="text-[10px] text-slate-400 italic truncate line-through">
                        {debt.note}
                    </p>
                )}
                <p className="text-[10px] text-slate-400 mt-0.5">
                    Opened {formatDebtDate(debt.createdAt)}
                    {debt.resolvedAt && ` · Resolved ${formatDebtDate(debt.resolvedAt)}`}
                </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Check className="w-3.5 h-3.5 text-slate-400" />
                <button
                    type="button"
                    onClick={() => onDelete(debt)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
    const [tab, setTab] = useState<'personal' | 'splitup'>('personal');
    const [showNewForm, setShowNewForm] = useState(false);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);
    const { format } = useCurrency();

    const convexGroups = useQuery((api as any).groups?.getMyGroups || (api as any).groups?.listGroups, {});

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

    const handleSettleAll = async (
        group: CounterpartyGroup,
        paidWith: PaymentSource
    ) => {
        const sorted = [...group.openDebts].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        for (const d of sorted) {
            await settleDebtCash(d.id, d.remainingALL, paidWith);
        }
    };

    const handleDeleteDebt = async (debt: DebtRecord) => {
        const isLinked = await hasLinkedExpenses(debt);
        if (isLinked) {
            setConfirm({
                isOpen: true,
                title: 'Delete both the debt AND the transaction?',
                message:
                    'This debt is linked to a transaction in Recent Activity. Deleting it will also remove the transaction and any settlements linked to it. Continue?',
                confirmLabel: 'Delete both',
                onConfirm: async () => {
                    await deleteDebt(debt.id);
                },
            });
            return;
        }

        await deleteDebt(debt.id);
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />

            <div
                className="w-full max-w-md max-h-[90vh] flex flex-col bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                            <HandCoins className="w-4 h-4 text-indigo-600" />
                        </div>
                        <h2 className="text-base font-bold text-slate-900">Debts & Splitting</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Subnav Tabs */}
                <div className="p-1 bg-slate-100 mx-4 mt-3 rounded-2xl grid grid-cols-2 text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => setTab('personal')}
                        className={cn(
                            'py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5',
                            tab === 'personal'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        )}
                    >
                        <HandCoins className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Personal</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('splitup')}
                        className={cn(
                            'py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5',
                            tab === 'splitup'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        )}
                    >
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Splitup Groups ({convexGroups?.length || 0})</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                    {tab === 'personal' ? (
                        <>
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                    {groups.length} {groups.length === 1 ? 'person' : 'people'}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowNewForm((prev) => !prev)}
                                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    {showNewForm ? 'Close form' : 'New debt'}
                                </button>
                            </div>

                            {showNewForm && (
                                <NewDebtForm
                                    onSaved={() => {
                                        setShowNewForm(false);
                                    }}
                                />
                            )}

                            {groups.length === 0 ? (
                                <div className="text-center py-10 px-4 rounded-2xl bg-slate-50 border border-slate-200 border-dashed">
                                    <p className="text-xs font-medium text-slate-500">No debts recorded.</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        Tap "New debt" above to track money you lent or borrowed.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {groups.map((g) => {
                                        const isExpanded = expandedKey === g.key;
                                        const net = g.receivables - g.payables;
                                        const hasOpen = g.openDebts.length > 0;

                                        return (
                                            <div
                                                key={g.key}
                                                className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setExpandedKey(isExpanded ? null : g.key)
                                                    }
                                                    className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer hover:bg-slate-50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                                                            <span className="text-xs font-bold text-indigo-700">
                                                                {g.name.charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-slate-900 truncate">
                                                                {g.name}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400">
                                                                {g.openDebts.length} open · {g.resolvedDebts.length} resolved
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="text-right">
                                                            <p
                                                                className={cn(
                                                                    'text-sm font-mono font-bold',
                                                                    net > 0
                                                                        ? 'text-emerald-600'
                                                                        : net < 0
                                                                            ? 'text-rose-600'
                                                                            : 'text-slate-500'
                                                                )}
                                                            >
                                                                {net > 0 ? '+' : ''}
                                                                {format(Math.abs(net))}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                                                                {net > 0 ? 'owes you' : net < 0 ? 'you owe' : 'settled'}
                                                            </p>
                                                        </div>
                                                        <ChevronDown
                                                            className={cn(
                                                                'w-4 h-4 text-slate-400 transition-transform duration-200',
                                                                isExpanded && 'rotate-180'
                                                            )}
                                                        />
                                                    </div>
                                                </button>

                                                {isExpanded && (
                                                    <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-slate-100 bg-slate-50/50">
                                                        {hasOpen && (
                                                            <div className="flex items-center justify-between pt-1">
                                                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                                                    Settle all
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSettleAll(g, 'Cash')}
                                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold border border-teal-200 cursor-pointer"
                                                                >
                                                                    <Banknote className="w-3 h-3" />
                                                                    All (Cash)
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSettleAll(g, 'Card')}
                                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold border border-rose-200 cursor-pointer"
                                                                >
                                                                    <CheckCheck className="w-3.5 h-3.5" />
                                                                    All (Bank)
                                                                </button>
                                                            </div>
                                                        )}

                                                        {g.openDebts.map((d) => (
                                                            <DebtRow key={d.id} debt={d} onDelete={handleDeleteDebt} />
                                                        ))}

                                                        {g.resolvedDebts.length > 0 && (
                                                            <>
                                                                {g.openDebts.length > 0 && (
                                                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pt-1">
                                                                        Resolved
                                                                    </p>
                                                                )}
                                                                {g.resolvedDebts.map((d) => (
                                                                    <ResolvedDebtRow key={d.id} debt={d} onDelete={handleDeleteDebt} />
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
                        </>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                    Convex Splitup Groups
                                </p>
                            </div>

                            {convexGroups === undefined ? (
                                <div className="p-8 text-center text-xs text-slate-400">Loading Splitup groups...</div>
                            ) : convexGroups.length === 0 ? (
                                <div className="text-center py-10 px-4 rounded-2xl bg-slate-50 border border-slate-200 border-dashed space-y-2">
                                    <p className="text-xs font-bold text-slate-700">No active Splitup groups</p>
                                    <p className="text-[11px] text-slate-400">
                                        Open Splitup to create a trip group or join using an invite code.
                                    </p>
                                </div>
                            ) : (
                                convexGroups.map((cg: any) => {
                                    const net = cg.myNetBalanceALL ?? cg.netBalanceALL ?? cg.netBalance ?? 0;
                                    return (
                                        <div
                                            key={cg._id}
                                            className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                                    👥
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-900 text-sm">{cg.name}</h4>
                                                    <p className="text-[10px] text-slate-400 font-mono">
                                                        Invite Code: {cg.inviteCode || cg._id.slice(-6).toUpperCase()}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <p
                                                    className={cn(
                                                        'text-xs font-mono font-bold',
                                                        net > 0 ? 'text-emerald-600' : net < 0 ? 'text-rose-600' : 'text-slate-400'
                                                    )}
                                                >
                                                    {net > 0 ? '+' : ''}
                                                    {format(Math.abs(net))}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-medium">
                                                    {net > 0 ? 'get back' : net < 0 ? 'you owe' : 'settled'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};