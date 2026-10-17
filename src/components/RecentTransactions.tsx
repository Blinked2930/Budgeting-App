// src/components/RecentTransactions.tsx
import React from 'react';
import {
  Trash2,
  Pencil,
  CheckCircle2,
  Clock,
  Utensils,
  Lightbulb,
  Bus,
  Users,
  Plane,
  MoreHorizontal,
  Banknote,
  Wallet,
  ArrowLeftRight,
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import type { ExpenseRecord, Category, TransferRecord, DebtRecord } from '../types';
import { formatCurrency } from '../utils/currency';
import { deleteExpense, deleteTransfer, deleteDebt } from '../db';
import { cn } from '../utils/cn';

interface RecentTransactionsProps {
  expenses: ExpenseRecord[];
  transfers?: TransferRecord[];
  debts?: DebtRecord[];
  onDeleted?: () => void;
  onEdit?: (expense: ExpenseRecord) => void;
}

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  Food: <Utensils className="w-3.5 h-3.5 text-emerald-400" />,
  Utilities: <Lightbulb className="w-3.5 h-3.5 text-amber-400" />,
  Transport: <Bus className="w-3.5 h-3.5 text-cyan-400" />,
  Social: <Users className="w-3.5 h-3.5 text-purple-400" />,
  Travel: <Plane className="w-3.5 h-3.5 text-rose-400" />,
  Other: <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />,
};

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(isoString).toLocaleDateString('sq-AL', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Recent';
  }
}

type MergedItem =
  | { kind: 'expense'; record: ExpenseRecord; timestamp: string }
  | { kind: 'transfer'; record: TransferRecord; timestamp: string }
  | { kind: 'debt'; record: DebtRecord; timestamp: string };

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  expenses,
  transfers = [],
  debts = [],
  onDeleted,
  onEdit,
}) => {
  const handleDeleteExpense = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteExpense(id);
    if (onDeleted) onDeleted();
  };

  const handleDeleteTransfer = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteTransfer(id);
    if (onDeleted) onDeleted();
  };

  const handleDeleteDebt = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDebt(id);
    if (onDeleted) onDeleted();
  };

  const handleEdit = (expense: ExpenseRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(expense);
  };

  const openDebts = debts.filter((d) => d.status === 'open');
  // Hide wallet movements that back a debt event — the debt row (or the
  // balance change) already tells the story. The expense record still
  // exists for budget math; it's just not shown here.
  const visibleExpenses = expenses.filter((e) => !e.debtRelated);

  const merged: MergedItem[] = [
    ...visibleExpenses.map((e) => ({ kind: 'expense' as const, record: e, timestamp: e.timestamp })),
    ...transfers.map((t) => ({ kind: 'transfer' as const, record: t, timestamp: t.timestamp })),
    ...openDebts.map((d) => ({ kind: 'debt' as const, record: d, timestamp: d.createdAt })),
  ].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  if (merged.length === 0) {
    return (
      <div className="w-full text-center py-8 px-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-slate-500">
        <p className="text-xs font-medium">No expenses logged yet.</p>
        <p className="text-[11px] text-slate-600 mt-0.5">
          Enter an amount above to record your first transaction offline!
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Recent Dexie Logs
        </h2>
        <span className="text-[11px] font-mono text-slate-500">
          {merged.length} recorded
        </span>
      </div>

      <div className="space-y-1.5">
        {merged.slice(0, 15).map((item) => {
          if (item.kind === 'debt') {
            const d = item.record;
            const owedToMe = d.direction === 'OwedToMe';
            const partial = d.remainingALL < d.amountALL;
            return (
              <div
                key={d.id}
                className="group flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-purple-500/25 transition-all hover:border-purple-500/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center shrink-0">
                    {owedToMe ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" />
                    ) : (
                      <ArrowDownLeft className="w-3.5 h-3.5 text-purple-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-purple-200 truncate">
                      {owedToMe ? `${d.counterparty} owes you` : `You owe ${d.counterparty}`}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                      <span>{formatRelativeTime(d.createdAt)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <HandCoins className="w-3 h-3 text-purple-400" />
                        <span className="text-[10px] text-purple-300">Debt</span>
                      </span>
                      {partial && (
                        <>
                          <span>•</span>
                          <span className="text-[10px] text-slate-500">
                            of {formatCurrency(d.amountALL, 'ALL')}
                          </span>
                        </>
                      )}
                    </div>
                    {d.note && (
                      <p className="text-[10px] text-slate-500 italic truncate mt-0.5">
                        {d.note}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <p
                    className={cn(
                      'text-sm font-bold font-mono tracking-tight',
                      owedToMe ? 'text-emerald-300' : 'text-rose-300'
                    )}
                  >
                    {formatCurrency(d.remainingALL, 'ALL')}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteDebt(d.id, e)}
                    className="opacity-40 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                    title="Delete debt"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }

          if (item.kind === 'transfer') {
            const t = item.record;
            const label = t.direction === 'BankToCash' ? 'Bank → Cash' : 'Cash → Bank';
            return (
              <div
                key={t.id}
                className="group flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 transition-all hover:border-slate-700/80"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-amber-300 truncate">
                      {label}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                      <span>{formatRelativeTime(t.timestamp)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {t.isSynced ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Clock className="w-3 h-3 text-slate-500" />
                        )}
                        <span className="text-[10px]">
                          {t.isSynced ? 'Synced' : 'Offline'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <p className="text-sm font-bold font-mono text-amber-300 tracking-tight">
                    {formatCurrency(t.amountALL, 'ALL')}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteTransfer(t.id, e)}
                    className="opacity-40 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                    title="Delete transfer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }

          const expense = item.record;
          const isForeignCurrency = expense.currency !== 'ALL';
          const isCash = expense.paidWith === 'Cash';

          return (
            <div
              key={expense.id}
              className="group flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 transition-all hover:border-slate-700/80"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-slate-800/90 border border-slate-700/50 flex items-center justify-center shrink-0">
                  {CATEGORY_ICONS[expense.category] || <MoreHorizontal className="w-3.5 h-3.5" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {expense.itemName || expense.category}
                    </span>
                    {expense.vendorType && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-800 text-slate-400 font-medium">
                        {expense.vendorType}
                      </span>
                    )}
                    {expense.estimatedMeals && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-400 font-medium">
                        {expense.estimatedMeals} meal{expense.estimatedMeals > 1 ? 's' : ''}
                      </span>
                    )}
                    {expense.walletNeutral && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-700/50 text-slate-400 font-medium">
                        no wallet impact
                      </span>
                    )}
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded-md font-medium flex items-center gap-0.5',
                        isCash
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-cyan-500/10 text-cyan-400'
                      )}
                      title={isCash ? 'Paid with cash' : 'Paid with card'}
                    >
                      {isCash ? (
                        <Banknote className="w-2.5 h-2.5" />
                      ) : (
                        <Wallet className="w-2.5 h-2.5" />
                      )}
                      {isCash ? 'Cash' : 'Card'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                    <span>{formatRelativeTime(expense.timestamp)}</span>
                    <span>•</span>
                    <span
                      className="flex items-center gap-1"
                      title={expense.isSynced ? 'Synced with cloud' : 'Saved locally offline in Dexie'}
                    >
                      {expense.isSynced ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Clock className="w-3 h-3 text-slate-500" />
                      )}
                      <span className="text-[10px]">{expense.isSynced ? 'Synced' : 'Offline'}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                <div className="text-right">
                  <p className="text-sm font-bold font-mono text-white tracking-tight">
                    {formatCurrency(expense.amount, expense.currency)}
                  </p>
                  {isForeignCurrency && (
                    <p className="text-[10px] font-mono text-emerald-400 font-medium">
                      ≈ {formatCurrency(expense.amountInALL, 'ALL')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => handleEdit(expense, e)}
                    className="opacity-40 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer"
                    title="Edit record"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteExpense(expense.id, e)}
                    className="opacity-40 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                    title="Delete record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};