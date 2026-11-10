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
  Save,
  CheckCheck,
  TriangleAlert,
  Users,
  Search,
  History,
  RotateCcw,
  Sparkles,
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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
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
    <div className="p-4 rounded-2xl bg-slate-50 border border-indigo-200 space-y-3.5 shadow-xs">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-indigo-600" />
          Record New Loan or Debt
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDirection('OwedToMe')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer',
            direction === 'OwedToMe'
              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
          )}
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
          I lent money
        </button>
        <button
          type="button"
          onClick={() => setDirection('iOwe')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer',
            direction === 'iOwe'
              ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs'
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
          )}
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
          They lent me
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
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Initial Money Moved Via
        </p>
        <div className="inline-flex w-full p-1 rounded-2xl bg-white border border-slate-200">
          <button
            type="button"
            onClick={() => setPaidWith('Cash')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
              paidWith === 'Cash'
                ? 'bg-teal-50 text-teal-700 font-bold'
                : 'text-slate-400 hover:text-slate-600'
            )}
          >
            <Banknote className="w-3.5 h-3.5" />
            Cash Wallet
          </button>
          <button
            type="button"
            onClick={() => setPaidWith('Card')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
              paidWith === 'Card'
                ? 'bg-rose-50 text-rose-700 font-bold'
                : 'text-slate-400 hover:text-slate-600'
            )}
          >
            <Wallet className="w-3.5 h-3.5" />
            Bank Account
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
        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50 hover:bg-indigo-700 transition-colors shadow-xs"
      >
        {isSaving ? 'Saving…' : 'Save Debt Record'}
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
  const [editRemaining, setEditRemaining] = useState(String(debt.remainingALL));
  const [editNote, setEditNote] = useState(debt.note || '');
  const [editDirection, setEditDirection] = useState<DebtDirection>(debt.direction);

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
    const newRemaining = parseFloat(editRemaining) ?? newAmount;
    await updateDebt(debt.id, {
      counterparty: editName.trim() || debt.counterparty,
      amountALL: newAmount,
      remainingALL: Math.min(newRemaining, newAmount),
      note: editNote.trim() || undefined,
      direction: editDirection,
    });
    setBusyAction(null);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Edit Debt Details</p>
          <div className="flex gap-1">
            <button onClick={() => setIsEditing(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleSaveEdit} disabled={busyAction === 'save'} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 cursor-pointer">
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setEditDirection('OwedToMe')}
            className={cn(
              'py-1.5 rounded-xl text-xs font-bold border cursor-pointer',
              editDirection === 'OwedToMe' ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-white border-slate-200 text-slate-500'
            )}
          >
            Owes me
          </button>
          <button
            type="button"
            onClick={() => setEditDirection('iOwe')}
            className={cn(
              'py-1.5 rounded-xl text-xs font-bold border cursor-pointer',
              editDirection === 'iOwe' ? 'bg-rose-100 border-rose-400 text-rose-800' : 'bg-white border-slate-200 text-slate-500'
            )}
          >
            I owe
          </button>
        </div>

        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase">Person Name</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 font-semibold uppercase">Original (L)</label>
            <input
              type="number"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-semibold uppercase">Remaining (L)</label>
            <input
              type="number"
              value={editRemaining}
              onChange={(e) => setEditRemaining(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase">Note</label>
          <input
            type="text"
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder="Note"
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveEdit}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1',
              owedToMe ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            )}
          >
            {owedToMe ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
            {owedToMe ? 'Owes you' : 'You owe'}
          </span>
          {debt.sourceExpenseId && (
            <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md">
              Shared Split
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="text-right">
            <span className="text-sm font-mono font-extrabold text-slate-900">
              {format(debt.remainingALL)}
            </span>
            {debt.amountALL !== debt.remainingALL && (
              <p className="text-[9px] font-mono text-slate-400 line-through">
                orig. {format(debt.amountALL)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors"
            title="Edit debt"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(debt)}
            disabled={busyAction !== null}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
            title="Delete debt"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {debt.note && <p className="text-xs text-slate-600 italic bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">{debt.note}</p>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
        <span>Opened {formatDebtDate(debt.createdAt)}</span>
        {debt.myShareAmountALL !== undefined && (
          <span>· Your share: {format(debt.myShareAmountALL)}</span>
        )}
      </div>

      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0"
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isPartial ? (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                Partial: {format(clamped)}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                Full Settle
              </span>
            )}
            {requested !== debt.remainingALL && (
              <button
                type="button"
                onClick={() => setAmountStr(String(debt.remainingALL))}
                className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer ml-1"
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
              Cash
            </button>
            <button
              type="button"
              onClick={() => handleCash('Card')}
              disabled={busyAction !== null || !isValid}
              className="py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 border border-rose-200"
            >
              <Wallet className="w-3 h-3" />
              Bank
            </button>
            <button
              type="button"
              onClick={() => handleNonCash('Cash')}
              disabled={busyAction !== null || !isValid}
              className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-slate-200"
              title="They offset via another purchase (Hits budget)"
            >
              Offset
            </button>
            <button
              type="button"
              onClick={handleWriteOff}
              disabled={busyAction !== null}
              className="py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-amber-200"
              title="Forgive debt"
            >
              Forgive
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
                Paid Cash
              </button>
              <button
                type="button"
                onClick={() => handleCash('Card')}
                disabled={busyAction !== null || !isValid}
                className="py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 border border-rose-200"
              >
                <Wallet className="w-3 h-3" />
                Paid Bank
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => handleNonCash('Cash')}
                disabled={busyAction !== null || !isValid}
                className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-slate-200"
                title="Bought them something with cash (Wallet only)"
              >
                Offset Cash
              </button>
              <button
                type="button"
                onClick={handleWriteOff}
                disabled={busyAction !== null}
                className="py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-amber-200"
                title="They forgave this debt"
              >
                Forgiven
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ResolvedDebtRow: React.FC<{ debt: DebtRecord; onDelete: (debt: DebtRecord) => void; onReopen: (debt: DebtRecord) => void }> = ({
  debt,
  onDelete,
  onReopen,
}) => {
  const owedToMe = debt.direction === 'OwedToMe';
  const { format } = useCurrency();

  return (
    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[10px] font-bold uppercase tracking-wider line-through',
              owedToMe ? 'text-emerald-600/70' : 'text-rose-500/70'
            )}
          >
            {owedToMe ? 'Owed you' : 'You owed'} {format(debt.amountALL)}
          </span>
          <span className="text-[9px] font-semibold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded-md">
            Resolved
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">{debt.counterparty}</p>
        {debt.note && <p className="text-[11px] text-slate-500 italic truncate">{debt.note}</p>}
        <p className="text-[10px] text-slate-400 mt-1">
          Opened {formatDebtDate(debt.createdAt)}
          {debt.resolvedAt && ` · Resolved ${formatDebtDate(debt.resolvedAt)}`}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onReopen(debt)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
          title="Reopen debt"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(debt)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          title="Delete resolved record"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const DebtsPanel: React.FC<DebtsPanelProps> = ({ isOpen, onClose }) => {
  const { debts, openDebts, resolvedDebts, totalOwedToMe, totalIOwe, netBalance } = useDebts();
  const [tab, setTab] = useState<'active' | 'fulfilled' | 'splitup'>('active');
  const [showNewForm, setShowNewForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
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
      const aTotal = a.receivables + a.payables;
      const bTotal = b.receivables + b.payables;
      if (aTotal !== bTotal) return bTotal - aTotal;
      return a.name.localeCompare(b.name);
    });
  }, [debts, searchQuery]);

  const activeGroups = useMemo(() => groups.filter((g) => g.openDebts.length > 0), [groups]);
  const fulfilledList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return resolvedDebts;
    return resolvedDebts.filter(
      (d) => d.counterparty.toLowerCase().includes(q) || (d.note || '').toLowerCase().includes(q)
    );
  }, [resolvedDebts, searchQuery]);

  const handleSettleAll = async (group: CounterpartyGroup, paidWith: PaymentSource) => {
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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />

      <div
        className="w-full max-w-lg h-[90vh] sm:h-[85vh] max-h-[800px] flex flex-col bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden min-h-0 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
              <HandCoins className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Debts & Group Balances</h2>
              <p className="text-[10px] text-slate-400">Personal loans, splits, and Splitup sync</p>
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

        <div className="px-5 pt-4 shrink-0">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-md flex items-center justify-between">
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
                {netBalance > 0 ? 'Net Receivable (Owed to you)' : netBalance < 0 ? 'Net Payable (You owe)' : 'Balanced position'}
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

        <div className="px-5 pt-3 shrink-0">
          <div className="p-1 bg-slate-100 rounded-2xl grid grid-cols-3 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={cn(
                'py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5',
                tab === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <HandCoins className="w-3.5 h-3.5 text-indigo-600" />
              <span>Active ({openDebts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('fulfilled')}
              className={cn(
                'py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5',
                tab === 'fulfilled' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <History className="w-3.5 h-3.5 text-teal-600" />
              <span>Fulfilled ({resolvedDebts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('splitup')}
              className={cn(
                'py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5',
                tab === 'splitup' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>Splitup ({convexGroups?.length || 0})</span>
            </button>
          </div>
        </div>

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
            <span>{showNewForm ? 'Close' : 'New Debt'}</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-3 touch-pan-y">
          {showNewForm && (
            <NewDebtForm
              onSaved={() => {
                setShowNewForm(false);
              }}
            />
          )}

          {tab === 'active' && (
            <>
              {activeGroups.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-3xl bg-slate-50 border border-slate-200 border-dashed space-y-2">
                  <Sparkles className="w-8 h-8 text-indigo-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">All settled up!</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    You have no active open debts. Tap "New Debt" above or log a shared expense in Quick Entry.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeGroups.map((g) => {
                    const isExpanded = expandedKey === g.key;
                    const net = g.receivables - g.payables;
                    const hasOpen = g.openDebts.length > 0;

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
                                {g.openDebts.length} active obligation{g.openDebts.length === 1 ? '' : 's'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <p
                                className={cn(
                                  'text-sm font-mono font-extrabold',
                                  net > 0 ? 'text-emerald-600' : net < 0 ? 'text-rose-600' : 'text-slate-500'
                                )}
                              >
                                {net > 0 ? '+' : ''}
                                {format(Math.abs(net))}
                              </p>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                {net > 0 ? 'owes you' : net < 0 ? 'you owe' : 'even'}
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
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Quick Settle All
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSettleAll(g, 'Cash')}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold border border-teal-200 cursor-pointer"
                                  >
                                    <Banknote className="w-3 h-3" />
                                    All Cash
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSettleAll(g, 'Card')}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold border border-rose-200 cursor-pointer"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    All Bank
                                  </button>
                                </div>
                              </div>
                            )}

                            {g.openDebts.map((d) => (
                              <DebtRow key={d.id} debt={d} onDelete={handleDeleteDebt} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'fulfilled' && (
            <div className="space-y-2">
              {fulfilledList.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-3xl bg-slate-50 border border-slate-200 border-dashed">
                  <p className="text-xs font-medium text-slate-500">No fulfilled debts in history.</p>
                </div>
              ) : (
                fulfilledList.map((d) => (
                  <ResolvedDebtRow
                    key={d.id}
                    debt={d}
                    onDelete={handleDeleteDebt}
                    onReopen={handleReopenDebt}
                  />
                ))
              )}
            </div>
          )}

          {tab === 'splitup' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Live Convex Splitup Groups
                </p>
              </div>

              {convexGroups === undefined ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading Splitup groups...</div>
              ) : convexGroups.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-3xl bg-slate-50 border border-slate-200 border-dashed space-y-2">
                  <p className="text-xs font-bold text-slate-700">No active Splitup groups found</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Open the Splitup app to create trip groups or join using invite codes.
                  </p>
                </div>
              ) : (
                convexGroups.map((cg: any) => {
                  const net = cg.myNetBalanceALL ?? cg.netBalanceALL ?? cg.netBalance ?? 0;
                  return (
                    <div
                      key={cg._id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold text-lg">
                          👥
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{cg.name}</h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Code: {cg.inviteCode || cg._id.slice(-6).toUpperCase()}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={cn(
                            'text-sm font-mono font-extrabold',
                            net > 0 ? 'text-emerald-600' : net < 0 ? 'text-rose-600' : 'text-slate-400'
                          )}
                        >
                          {net > 0 ? '+' : ''}
                          {format(Math.abs(net))}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
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
    </div>,
    document.body
  );
};