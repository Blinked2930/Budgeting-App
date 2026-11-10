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
  ChevronDown,
  Trash2,
  Pencil,
  TriangleAlert,
  Search,
  RotateCcw,
  Sparkles,
  ArrowRightLeft,
  Gift,
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
  db,
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
      className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 font-sans"
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
            className="py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className="py-2.5 rounded-2xl bg-rose-600 text-white text-xs font-bold cursor-pointer hover:bg-rose-700 transition-colors"
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
    <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3.5 shadow-xs font-sans">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-indigo-600" />
          Record New Transaction or Entry
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDirection('OwedToMe')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer',
            direction === 'OwedToMe'
              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
          )}
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
          I lent / paid for them
        </button>
        <button
          type="button"
          onClick={() => setDirection('iOwe')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer',
            direction === 'iOwe'
              ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs'
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
          )}
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
          They lent / paid for me
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="Person Name"
            list="lekflow-counterparties-panel"
            className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          <datalist id="lekflow-counterparties-panel">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          placeholder="Amount (Lek)"
          className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Payment Source
        </p>
        <div className="inline-flex w-full p-1 rounded-xl bg-white border border-slate-200">
          <button
            type="button"
            onClick={() => setPaidWith('Cash')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
              paidWith === 'Cash' ? 'bg-teal-50 text-teal-700 font-bold' : 'text-slate-400 hover:text-slate-600'
            )}
          >
            <Banknote className="w-3.5 h-3.5" />
            Physical Cash
          </button>
          <button
            type="button"
            onClick={() => setPaidWith('Card')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
              paidWith === 'Card' ? 'bg-rose-50 text-rose-700 font-bold' : 'text-slate-400 hover:text-slate-600'
            )}
          >
            <Wallet className="w-3.5 h-3.5" />
            Bank (Card)
          </button>
        </div>
      </div>

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (e.g. Coffee, Groceries, Movie)"
        className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={!valid || isSaving}
        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50 hover:bg-indigo-700 transition-colors shadow-xs"
      >
        {isSaving ? 'Saving…' : 'Add Entry to Ledger'}
      </button>
    </div>
  );
};

const LedgerItemRow: React.FC<{
  debt: DebtRecord;
  onDelete: (debt: DebtRecord) => void;
  onReopen: (debt: DebtRecord) => void;
}> = ({ debt, onDelete, onReopen }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editNote, setEditNote] = useState(debt.note || '');
  const [editAmount, setEditAmount] = useState(String(debt.amountALL));

  const { format } = useCurrency();
  const owedToMe = debt.direction === 'OwedToMe';
  const isResolved = debt.status === 'resolved';

  const handleSave = async () => {
    const val = parseFloat(editAmount);
    if (Number.isNaN(val) || val <= 0) return;
    await updateDebt(debt.id, {
      amountALL: val,
      remainingALL: isResolved ? 0 : Math.min(debt.remainingALL, val),
      note: editNote.trim() || undefined,
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2 text-xs font-sans">
        <div className="flex items-center justify-between">
          <span className="font-bold text-indigo-900">Edit Entry</span>
          <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="any"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 font-mono"
          />
          <input
            type="text"
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder="Note"
            className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200"
          />
        </div>
        <div className="flex justify-end gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-3 rounded-2xl border flex items-center justify-between gap-3 font-sans transition-colors',
        isResolved ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-white border-slate-200 shadow-2xs'
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1',
              owedToMe
                ? isResolved
                  ? 'bg-slate-200 text-slate-600'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : isResolved
                  ? 'bg-slate-200 text-slate-600'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
            )}
          >
            {owedToMe ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
            {owedToMe ? 'Owed to you' : 'You owed'}
          </span>
          {isResolved && (
            <span className="text-[9px] font-semibold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-md">
              Balanced
            </span>
          )}
        </div>
        {debt.note && <p className="text-xs text-slate-800 font-medium mt-1 truncate">{debt.note}</p>}
        <p className="text-[10px] text-slate-400 mt-0.5">
          {formatDebtDate(debt.createdAt)}
          {isResolved && debt.resolvedAt && ` · Settled ${formatDebtDate(debt.resolvedAt)}`}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="text-right">
          <p
            className={cn(
              'text-xs font-mono font-bold',
              isResolved ? 'text-slate-400 line-through' : owedToMe ? 'text-emerald-600' : 'text-rose-600'
            )}
          >
            {format(debt.amountALL)}
          </p>
          {!isResolved && debt.remainingALL !== debt.amountALL && (
            <p className="text-[9px] font-mono text-slate-400">bal: {format(debt.remainingALL)}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
          title="Edit entry"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {isResolved ? (
          <button
            type="button"
            onClick={() => onReopen(debt)}
            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
            title="Reopen entry"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onDelete(debt)}
          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          title="Delete entry"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const DebtsPanel: React.FC<DebtsPanelProps> = ({ isOpen, onClose }) => {
  const { debts, totalOwedToMe, totalIOwe, netBalance } = useDebts();
  const [showNewForm, setShowNewForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [actionAmountMap, setActionAmountMap] = useState<Record<string, string>>({});
  const [busyPerson, setBusyPerson] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const { format } = useCurrency();
  const convexGroups = useQuery((api as any).groups?.getMyGroups || (api as any).groups?.listGroups, {});

  const groups = useMemo<CounterpartyGroup[]>(() => {
    const map = new Map<string, CounterpartyGroup>();
    const q = searchQuery.trim().toLowerCase();

    for (const d of debts) {
      if (q) {
        const matchesName = d.counterparty.toLowerCase().includes(q);
        const matchesNote = (d.note || '').toLowerCase().includes(q);
        if (!matchesName && !matchesNote) continue;
      }

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
      const aNet = Math.abs(a.receivables - a.payables);
      const bNet = Math.abs(b.receivables - b.payables);
      if (aNet !== bNet) return bNet - aNet;
      return a.name.localeCompare(b.name);
    });
  }, [debts, searchQuery]);

  useEffect(() => {
    if (groups.length > 0 && !expandedKey) {
      setExpandedKey(groups[0].key);
    }
  }, [groups]);

  const handlePersonAction = async (
    g: CounterpartyGroup,
    actionType: 'pay_cash' | 'pay_card' | 'offset_cash' | 'offset_card' | 'forgive'
  ) => {
    const net = g.receivables - g.payables;
    const defaultAmount = Math.abs(net);
    const inputVal = actionAmountMap[g.key];
    const parsed = parseFloat(inputVal ?? '');
    const amountToApply = !Number.isNaN(parsed) && parsed > 0 ? parsed : defaultAmount;

    if (amountToApply <= 0) return;
    setBusyPerson(g.key);

    let remainingToApply = amountToApply;
    const sortedOpen = [...g.openDebts].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const d of sortedOpen) {
      if (remainingToApply <= 0) break;
      const settleAmt = Math.min(d.remainingALL, remainingToApply);

      if (actionType === 'pay_cash') {
        await settleDebtCash(d.id, settleAmt, 'Cash');
      } else if (actionType === 'pay_card') {
        await settleDebtCash(d.id, settleAmt, 'Card');
      } else if (actionType === 'offset_cash') {
        await settleDebtNonCash(d.id, settleAmt, 'Cash');
      } else if (actionType === 'offset_card') {
        await settleDebtNonCash(d.id, settleAmt, 'Card');
      } else if (actionType === 'forgive') {
        if (settleAmt >= d.remainingALL) {
          await writeOffDebt(d.id);
        } else {
          const newRemaining = d.remainingALL - settleAmt;
          await db.debts.update(d.id, {
            remainingALL: newRemaining,
            status: newRemaining === 0 ? 'resolved' : 'open',
            resolvedAt: newRemaining === 0 ? new Date().toISOString() : undefined,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      remainingToApply -= settleAmt;
    }

    setBusyPerson(null);
    setActionAmountMap((prev) => ({ ...prev, [g.key]: '' }));
  };

  const handleDeleteDebt = async (debt: DebtRecord) => {
    const isLinked = await hasLinkedExpenses(debt);
    if (isLinked) {
      setConfirm({
        isOpen: true,
        title: 'Delete linked transaction as well?',
        message:
          'This debt is linked to a transaction in your budget log. Deleting it will clean up both records and revert wallet movements.',
        confirmLabel: 'Delete Both Records',
        onConfirm: async () => {
          await deleteDebt(debt.id);
        },
      });
      return;
    }
    await deleteDebt(debt.id);
  };

  const handleReopenDebt = async (debt: DebtRecord) => {
    await db.debts.update(debt.id, {
      status: 'open',
      resolvedAt: undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />

      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden font-sans my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
              <HandCoins className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Debts & Running Ledgers</h2>
              <p className="text-[10px] text-slate-400">Continuous balance tracking by person</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Net Position Summary */}
        <div className="px-5 pt-4 shrink-0">
          <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-md flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Position</p>
              <p
                className={cn(
                  'text-2xl font-mono font-extrabold mt-0.5',
                  netBalance > 0 ? 'text-emerald-400' : netBalance < 0 ? 'text-rose-400' : 'text-slate-200'
                )}
              >
                {netBalance > 0 ? '+' : ''}
                {format(netBalance)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {netBalance > 0 ? 'Net Receivable (Owed to you)' : netBalance < 0 ? 'Net Payable (You owe)' : 'Balanced overall'}
              </p>
            </div>

            <div className="space-y-1 text-right">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                +{format(totalOwedToMe)}
              </div>
              <br />
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold">
                <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
                -{format(totalIOwe)}
              </div>
            </div>
          </div>
        </div>

        {/* Search & Add Controls */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search person or note..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showNewForm ? 'Close' : 'New Entry'}</span>
          </button>
        </div>

        {/* Content List: Single Running Ledger List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-3 touch-pan-y">
          {showNewForm && (
            <NewDebtForm
              onSaved={() => {
                setShowNewForm(false);
              }}
            />
          )}

          {groups.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl bg-slate-50 border border-slate-200 border-dashed space-y-2">
              <Sparkles className="w-8 h-8 text-indigo-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700">All even!</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                No active people or balances recorded. Tap "New Entry" above to add a transaction.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => {
                const isExpanded = expandedKey === g.key;
                const net = g.receivables - g.payables;
                const allPersonDebts = [...g.openDebts, ...g.resolvedDebts].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                const isBusy = busyPerson === g.key;
                const currentActionInput = actionAmountMap[g.key] ?? '';

                return (
                  <div
                    key={g.key}
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedKey(isExpanded ? null : g.key)}
                      className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-indigo-700">
                            {g.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{g.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {allPersonDebts.length} historical entry{allPersonDebts.length === 1 ? '' : 'ies'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p
                            className={cn(
                              'text-sm font-mono font-extrabold',
                              net > 0 ? 'text-emerald-600' : net < 0 ? 'text-rose-600' : 'text-slate-400'
                            )}
                          >
                            {net === 0 ? 'Balanced' : `${net > 0 ? '+' : '−'}${format(Math.abs(net))}`}
                          </p>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            {net > 0 ? 'owes you' : net < 0 ? 'you owe' : 'all settled'}
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
                      <div className="px-3.5 pb-3.5 pt-2 space-y-3 border-t border-slate-100 bg-slate-50/50">
                        {/* Person-Level Actions */}
                        {net !== 0 && (
                          <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Adjust Running Balance
                              </p>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  placeholder={String(Math.abs(net))}
                                  value={currentActionInput}
                                  onChange={(e) =>
                                    setActionAmountMap({ ...actionAmountMap, [g.key]: e.target.value })
                                  }
                                  className="w-24 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-right text-slate-900 focus:outline-none focus:border-indigo-500"
                                />
                                <span className="text-[10px] font-mono text-slate-400">ALL</span>
                              </div>
                            </div>

                            {/* Action Buttons Grid */}
                            <div className="space-y-1.5">
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handlePersonAction(g, 'pay_cash')}
                                  className="py-1.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 cursor-pointer flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                                >
                                  <Banknote className="w-3 h-3 text-emerald-600" />
                                  {net > 0 ? 'Got Paid Cash' : 'Paid Cash'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handlePersonAction(g, 'pay_card')}
                                  className="py-1.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 cursor-pointer flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                                >
                                  <Wallet className="w-3 h-3 text-emerald-600" />
                                  {net > 0 ? 'Got Paid Bank' : 'Paid Bank'}
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handlePersonAction(g, 'offset_cash')}
                                  className="py-1.5 px-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[10px] font-bold border border-indigo-200 cursor-pointer flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                                  title="Offset with Cash purchase"
                                >
                                  <ArrowRightLeft className="w-3 h-3 text-indigo-600" />
                                  Offset Cash
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handlePersonAction(g, 'offset_card')}
                                  className="py-1.5 px-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[10px] font-bold border border-indigo-200 cursor-pointer flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                                  title="Offset with Bank purchase"
                                >
                                  <ArrowRightLeft className="w-3 h-3 text-indigo-600" />
                                  Offset Bank
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handlePersonAction(g, 'forgive')}
                                  className="py-1.5 px-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 cursor-pointer flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                                  title="Forgive / Gift this amount"
                                >
                                  <Gift className="w-3 h-3 text-amber-600" />
                                  Forgive / Gift
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Person Running Ledger */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pt-1">
                            Transaction History & Feed
                          </p>
                          {allPersonDebts.map((d) => (
                            <LedgerItemRow
                              key={d.id}
                              debt={d}
                              onDelete={handleDeleteDebt}
                              onReopen={handleReopenDebt}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Splitup Group Balances */}
              {Array.isArray(convexGroups) && convexGroups.length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Shared Trip & Group Balances (Splitup)
                  </p>
                  {convexGroups.map((cg: any) => {
                    const net = cg.myNetBalanceALL ?? cg.netBalanceALL ?? cg.netBalance ?? 0;
                    return (
                      <div
                        key={cg._id}
                        className="p-3 rounded-2xl border border-slate-200 bg-white shadow-2xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
                            👥
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{cg.name}</h4>
                            <p className="text-[9px] text-slate-400 font-mono">
                              Group ID: {cg.inviteCode || cg._id.slice(-6).toUpperCase()}
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
                            {net === 0 ? 'Settled' : `${net > 0 ? '+' : '−'}${format(Math.abs(net))}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};