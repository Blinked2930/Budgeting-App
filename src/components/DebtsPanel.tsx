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
  Check,
} from 'lucide-react';
import { useDebts } from '../hooks/useDebts';
import {
  addDebt,
  settleDebtCash,
  settleDebtOffset,
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
      className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-4.5 space-y-3.5 animate-in zoom-in-95 font-sans border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
            <TriangleAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900">{state.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{state.message}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className="py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer hover:bg-rose-700 transition-colors"
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
    <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-indigo-600" />
          Add Entry
        </h4>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Who paid / lent?
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setDirection('OwedToMe')}
            className={cn(
              'flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
              direction === 'OwedToMe'
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-800 shadow-2xs font-bold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            I paid for them
          </button>
          <button
            type="button"
            onClick={() => setDirection('iOwe')}
            className={cn(
              'flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
              direction === 'iOwe'
                ? 'bg-rose-50/80 border-rose-300 text-rose-800 shadow-2xs font-bold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
            They paid for me
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="Person Name"
            list="lekflow-counterparties-panel"
            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
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
          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Payment Method
        </p>
        <div className="inline-flex w-full p-0.5 rounded-xl bg-white border border-slate-200">
          <button
            type="button"
            onClick={() => setPaidWith('Cash')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer',
              paidWith === 'Cash' ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Banknote className="w-3.5 h-3.5 text-teal-600" />
            Physical Cash
          </button>
          <button
            type="button"
            onClick={() => setPaidWith('Card')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer',
              paidWith === 'Card' ? 'bg-indigo-50 text-indigo-800 font-bold' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Wallet className="w-3.5 h-3.5 text-indigo-600" />
            Bank (Card)
          </button>
        </div>
      </div>

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (e.g. Dinner, Coffee, Groceries)"
        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={!valid || isSaving}
        className="w-full py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50 hover:bg-indigo-700 transition-colors shadow-2xs"
      >
        {isSaving ? 'Saving…' : 'Add to Ledger'}
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
      <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs font-sans">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-indigo-900">Edit Entry</span>
          <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            type="number"
            step="any"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            className="px-2 py-1 rounded-lg bg-white border border-slate-200 font-mono text-xs"
          />
          <input
            type="text"
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder="Note"
            className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs"
          />
        </div>
        <div className="flex justify-end gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-2 py-0.5 rounded-md border border-slate-200 bg-white text-slate-600 text-[11px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-semibold text-[11px]"
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
        'p-2.5 rounded-xl border flex items-center justify-between gap-2.5 font-sans transition-colors',
        isResolved ? 'bg-slate-50/60 border-slate-200/80 opacity-70' : 'bg-white border-slate-200/80 shadow-2xs'
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex items-center gap-1',
              owedToMe
                ? isResolved
                  ? 'bg-slate-100 text-slate-500'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                : isResolved
                  ? 'bg-slate-100 text-slate-500'
                  : 'bg-rose-50 text-rose-700 border border-rose-200/60'
            )}
          >
            {owedToMe ? <ArrowUpRight className="w-2.5 h-2.5 text-emerald-600" /> : <ArrowDownLeft className="w-2.5 h-2.5 text-rose-600" />}
            {owedToMe ? 'Owed to you' : 'You owed'}
          </span>
          {isResolved && (
            <span className="text-[9px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
              Balanced
            </span>
          )}
        </div>
        {debt.note && <p className="text-xs text-slate-700 font-medium mt-1 truncate">{debt.note}</p>}
        <p className="text-[10px] text-slate-400 mt-0.5">
          {formatDebtDate(debt.createdAt)}
          {isResolved && debt.resolvedAt && ` · Settled ${formatDebtDate(debt.resolvedAt)}`}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
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
          <Pencil className="w-3 h-3" />
        </button>
        {isResolved && (
          <button
            type="button"
            onClick={() => onReopen(debt)}
            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
            title="Reopen entry"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(debt)}
          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          title="Delete entry"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dual-box settlement controls
// ---------------------------------------------------------------------------

interface FlowBoxProps {
  variant: 'inflow' | 'outflow';
  amount: string;
  onAmountChange: (v: string) => void;
  disabled: boolean;
  onAction: (method: PaymentSource | 'offset') => void;
}

const FlowBox: React.FC<FlowBoxProps> = ({ variant, amount, onAmountChange, disabled, onAction }) => {
  const isInflow = variant === 'inflow';
  const headerLabel = isInflow ? 'I Received' : 'I Paid';
  const headerSub = isInflow ? 'money / value came to me' : 'money / value left me';
  const Icon = isInflow ? ArrowDownLeft : ArrowUpRight;
  const amountNum = parseFloat(amount) || 0;
  const canAct = !disabled && amountNum > 0;

  return (
    <div
      className={cn(
        'p-2.5 rounded-xl border space-y-1.5 transition-colors',
        isInflow
          ? 'bg-emerald-50/50 border-emerald-200/70'
          : 'bg-rose-50/50 border-rose-200/70'
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p
            className={cn(
              'text-[10px] font-bold uppercase tracking-wider flex items-center gap-1',
              isInflow ? 'text-emerald-800' : 'text-rose-800'
            )}
          >
            <Icon className={cn('w-3 h-3', isInflow ? 'text-emerald-600' : 'text-rose-600')} />
            {headerLabel}
          </p>
          <p className={cn('text-[9px] mt-0.5', isInflow ? 'text-emerald-700/70' : 'text-rose-700/70')}>
            {headerSub}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0"
          className={cn(
            'flex-1 min-w-0 px-2 py-1 rounded-md bg-white border text-xs font-mono font-bold text-right',
            isInflow
              ? 'border-emerald-200 focus:border-emerald-500 text-emerald-900'
              : 'border-rose-200 focus:border-rose-500 text-rose-900',
            'focus:outline-none'
          )}
        />
        <span className={cn('text-[9px] font-mono font-semibold', isInflow ? 'text-emerald-700/70' : 'text-rose-700/70')}>
          ALL
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => onAction('Cash')}
          disabled={!canAct}
          className={cn(
            'py-1 rounded-md text-[10px] font-bold border flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            isInflow
              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200/70'
              : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200/70'
          )}
        >
          <Banknote className="w-3 h-3" />
          Cash
        </button>
        <button
          type="button"
          onClick={() => onAction('Card')}
          disabled={!canAct}
          className={cn(
            'py-1 rounded-md text-[10px] font-bold border flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            isInflow
              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200/70'
              : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200/70'
          )}
        >
          <Wallet className="w-3 h-3" />
          Bank
        </button>
        <button
          type="button"
          onClick={() => onAction('offset')}
          disabled={!canAct}
          className={cn(
            'py-1 rounded-md text-[10px] font-bold border flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            isInflow
              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200/70'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200/70'
          )}
          title="Non-cash offset — no wallet movement"
        >
          <ArrowRightLeft className="w-3 h-3" />
          Offset
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
  const [inflowMap, setInflowMap] = useState<Record<string, string>>({});
  const [outflowMap, setOutflowMap] = useState<Record<string, string>>({});
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
  }, [groups, expandedKey]);

  /**
   * Apply a flow action against a person's open debts.
   *
   * `flow` says whether money came IN or went OUT of my wallet (or, for
   * offset, which direction value flowed).
   *
   * `method`:
   *   'Cash'   → real cash wallet movement
   *   'Card'   → real bank wallet movement
   *   'offset' → no wallet movement, value offset only
   *
   * The matrix of (flow × method) vs. debt direction:
   *
   *   INFLOW + Cash/Card  → they paid me.
   *     Against an OwedToMe debt: pay it down (settleDebtCash).
   *     Against an iOwe debt:     they paid on my behalf → grow the debt
   *                               (settleDebtOffset, iOweMore).
   *
   *   INFLOW + offset     → I received value from them without cash.
   *     Against an OwedToMe debt: pay it down (settleDebtOffset, iOweMore).
   *     Against an iOwe debt:     grow the debt (settleDebtOffset, iOweMore).
   *
   *   OUTFLOW + Cash/Card → I paid them.
   *     Against an OwedToMe debt: I'm growing what they owe me OR they
   *                               paid me back — ambiguous. We treat it as
   *                               "I gave them money" → they now owe me more
   *                               (grow with settleDebtOffset, theyOweMore).
   *     Against an iOwe debt:     pay it down (settleDebtCash).
   *
   *   OUTFLOW + offset    → They received value from me without cash.
   *     Against an OwedToMe debt: grow what they owe me
   *                               (settleDebtOffset, theyOweMore).
   *     Against an iOwe debt:     pay it down (settleDebtOffset, theyOweMore).
   *
   * The panel walks the person's open debts oldest-first, applying as much
   * of the entered amount as each debt can absorb in the *primary* direction
   * (pays-down first), then any residual grows the first debt of the
   * opposite direction (or creates fresh growth on an existing record).
   */
  const applyFlow = async (
    g: CounterpartyGroup,
    flow: 'inflow' | 'outflow',
    method: PaymentSource | 'offset'
  ) => {
    const raw = flow === 'inflow' ? inflowMap[g.key] : outflowMap[g.key];
    const parsed = parseFloat(raw ?? '');
    const amount = !Number.isNaN(parsed) && parsed > 0 ? parsed : 0;
    if (amount <= 0) return;

    setBusyPerson(g.key);

    // Sort oldest-first so we pay down the oldest debts first.
    const sortedOpen = [...g.openDebts].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let remainingToApply = amount;

    // Which debt direction does this flow pay DOWN?
    //  INFLOW  + any method → pays down OwedToMe
    //  OUTFLOW + any method → pays down iOwe
    const paydownDirection: DebtDirection = flow === 'inflow' ? 'OwedToMe' : 'iOwe';
    // Which direction does this flow GROW (if residual spills over)?
    const growDirection: DebtDirection = flow === 'inflow' ? 'iOwe' : 'OwedToMe';

    // Phase 1 — pay down debts in the natural direction.
    for (const d of sortedOpen) {
      if (remainingToApply <= 0) break;
      if (d.direction !== paydownDirection) continue;

      const settleAmt = Math.min(d.remainingALL, remainingToApply);
      if (settleAmt <= 0) continue;

      if (method === 'offset') {
        // Non-cash offset against the natural direction.
        const dir: 'iOweMore' | 'theyOweMore' =
          d.direction === 'OwedToMe' ? 'iOweMore' : 'theyOweMore';
        await settleDebtOffset(d.id, settleAmt, dir);
      } else {
        await settleDebtCash(d.id, settleAmt, method);
      }

      remainingToApply -= settleAmt;
    }

    // Phase 2 — any residual grows the opposite-direction debt.
    if (remainingToApply > 0) {
      const growTargets = sortedOpen.filter((d) => d.direction === growDirection);

      if (growTargets.length > 0) {
        for (const d of growTargets) {
          if (remainingToApply <= 0) break;
          const growAmt = remainingToApply;
          const dir: 'iOweMore' | 'theyOweMore' =
            d.direction === 'iOwe' ? 'iOweMore' : 'theyOweMore';
          await settleDebtOffset(d.id, growAmt, dir);
          remainingToApply -= growAmt;
        }
      } else {
        // No existing debt of the opposite direction — create a new one
        // (without a wallet movement, since the "flow" here is the growth).
        const newDebt = await addDebt({
          counterparty: g.name,
          direction: growDirection,
          amountALL: remainingToApply,
          note: method === 'offset' ? 'Offset' : `${flow === 'inflow' ? 'Received' : 'Paid'} (${method})`,
        });
        // We already counted this as a wallet-flow at the caller level; the
        // addDebt above would try to create a wallet expense if we pass
        // moveWalletWith. We don't, so this is purely a ledger entry.
        void newDebt;
        remainingToApply = 0;
      }
    }

    setBusyPerson(null);
    setInflowMap((prev) => ({ ...prev, [g.key]: '' }));
    setOutflowMap((prev) => ({ ...prev, [g.key]: '' }));
  };

  const handleForgive = async (g: CounterpartyGroup) => {
    if (g.openDebts.length === 0) return;
    setBusyPerson(g.key);
    for (const d of g.openDebts) {
      await writeOffDebt(d.id);
    }
    setBusyPerson(null);
    setInflowMap((prev) => ({ ...prev, [g.key]: '' }));
    setOutflowMap((prev) => ({ ...prev, [g.key]: '' }));
  };

  const handleDeleteDebt = async (debt: DebtRecord) => {
    const isLinked = await hasLinkedExpenses(debt);
    if (isLinked) {
      setConfirm({
        isOpen: true,
        title: 'Delete linked transaction as well?',
        message:
          'This debt is linked to a budget transaction. Deleting it will clean up both records and revert wallet movements.',
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
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5 bg-slate-900/40 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />

      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white border border-slate-200/90 rounded-3xl shadow-xl overflow-hidden font-sans my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Header */}
        <div className="flex items-center justify-between px-4.5 pt-3.5 pb-2.5 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <HandCoins className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Debts & Running Ledgers</h2>
              <p className="text-[10px] text-slate-400">Continuous balance tracking by person</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Delicate Net Position Card */}
        <div className="px-4.5 pt-3 shrink-0">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Position</p>
              <p
                className={cn(
                  'text-xl font-mono font-extrabold mt-0.5',
                  netBalance > 0 ? 'text-emerald-600' : netBalance < 0 ? 'text-rose-600' : 'text-slate-700'
                )}
              >
                {netBalance > 0 ? '+' : ''}
                {format(netBalance)}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {netBalance > 0 ? 'Net Receivable (Owed to you)' : netBalance < 0 ? 'Net Payable (You owe)' : 'Balanced overall'}
              </p>
            </div>

            <div className="space-y-1 text-right">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-mono font-bold">
                <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                +{format(totalOwedToMe)}
              </div>
              <br />
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200/60 text-rose-700 text-xs font-mono font-bold">
                <ArrowDownLeft className="w-3 h-3 text-rose-600" />
                -{format(totalIOwe)}
              </div>
            </div>
          </div>
        </div>

        {/* Search & Add Controls */}
        <div className="px-4.5 pt-2.5 pb-2 flex items-center justify-between gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search person or note..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-7 pr-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showNewForm ? 'Close' : 'New Entry'}</span>
          </button>
        </div>

        {/* Content Feed */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4.5 pb-4 space-y-2.5 touch-pan-y">
          {showNewForm && (
            <NewDebtForm
              onSaved={() => {
                setShowNewForm(false);
              }}
            />
          )}

          {groups.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-2xl bg-slate-50/50 border border-slate-200/80 border-dashed space-y-1.5">
              <Sparkles className="w-6 h-6 text-indigo-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">All even!</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                No active balances. Tap "New Entry" above to add a transaction.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {groups.map((g) => {
                const isExpanded = expandedKey === g.key;
                const net = g.receivables - g.payables;
                const allPersonDebts = [...g.openDebts, ...g.resolvedDebts].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                const isBusy = busyPerson === g.key;
                const hasOpen = g.openDebts.length > 0;

                return (
                  <div
                    key={g.key}
                    className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedKey(isExpanded ? null : g.key)}
                      className="w-full flex items-center justify-between p-3 text-left cursor-pointer hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-indigo-700">
                            {g.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{g.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {allPersonDebts.length} entry{allPersonDebts.length === 1 ? '' : 'ies'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="text-right">
                          <p
                            className={cn(
                              'text-xs font-mono font-bold',
                              net > 0 ? 'text-emerald-600' : net < 0 ? 'text-rose-600' : 'text-slate-400'
                            )}
                          >
                            {net === 0 ? 'Balanced' : `${net > 0 ? '+' : '−'}${format(Math.abs(net))}`}
                          </p>
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                            {net > 0 ? 'owes you' : net < 0 ? 'you owe' : 'settled'}
                          </p>
                        </div>
                        <ChevronDown
                          className={cn(
                            'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
                            isExpanded && 'rotate-180'
                          )}
                        />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1.5 space-y-2.5 border-t border-slate-100 bg-slate-50/40">
                        {/* Dual-box Inflow / Outflow settlement controls */}
                        {hasOpen && (
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Settle / Adjust Balance
                              </p>
                              <p className="text-[9px] text-slate-400 italic">
                                Cash / Bank move the wallet · Offset doesn't
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <FlowBox
                                variant="inflow"
                                amount={inflowMap[g.key] ?? ''}
                                onAmountChange={(v) =>
                                  setInflowMap((prev) => ({ ...prev, [g.key]: v }))
                                }
                                disabled={isBusy}
                                onAction={(method) => applyFlow(g, 'inflow', method)}
                              />
                              <FlowBox
                                variant="outflow"
                                amount={outflowMap[g.key] ?? ''}
                                onAmountChange={(v) =>
                                  setOutflowMap((prev) => ({ ...prev, [g.key]: v }))
                                }
                                disabled={isBusy}
                                onAction={(method) => applyFlow(g, 'outflow', method)}
                              />
                            </div>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleForgive(g)}
                              className="w-full py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200/70 cursor-pointer flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                              title="Forgive all open balances with this person (logs a gift/write-off)"
                            >
                              <Gift className="w-3 h-3 text-amber-600" />
                              Forgive / Gift full balance
                            </button>

                            {isBusy && (
                              <p className="text-[9px] text-slate-400 text-center flex items-center justify-center gap-1">
                                <Check className="w-3 h-3 text-emerald-500" />
                                Applying…
                              </p>
                            )}
                          </div>
                        )}

                        {/* Person Ledger Feed */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-0.5">
                            Transaction Feed
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

              {/* Group Balances */}
              {Array.isArray(convexGroups) && convexGroups.length > 0 && (
                <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Shared Trip & Group Balances (Splitup)
                  </p>
                  {convexGroups.map((cg: any) => {
                    const net = cg.myNetBalanceALL ?? cg.netBalanceALL ?? cg.netBalance ?? 0;
                    return (
                      <div
                        key={cg._id}
                        className="p-2.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center text-xs font-bold">
                            👥
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{cg.name}</h4>
                            <p className="text-[9px] text-slate-400 font-mono">
                              ID: {cg.inviteCode || cg._id.slice(-6).toUpperCase()}
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