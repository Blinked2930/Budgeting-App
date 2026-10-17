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
  Gift,
} from 'lucide-react';
import type { ExpenseRecord, Category, TransferRecord } from '../types';
import { formatCurrency } from '../utils/currency';
import { deleteExpense, deleteTransfer } from '../db';
import { cn } from '../utils/cn';

interface RecentTransactionsProps {
  expenses: ExpenseRecord[];
  transfers?: TransferRecord[];
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

/**
 * Classify a debt-related expense into a display category.
 * Returns null for regular (non-debt) expenses.
 */
type DebtClass =
  | 'originLend'
  | 'originBorrow'
  | 'repaidIn'
  | 'repaidOut'
  | 'offsetIn'
  | 'offsetOut'
  | 'gift';

function classifyDebtExpense(e: ExpenseRecord): DebtClass | null {
  const hasDebt = Boolean(e.debtId) || Boolean(e.debtRelated) || Boolean(e.isDebtOrigin);
  if (!hasDebt) return null;

  const name = e.itemName ?? '';
  const walletNeutral = Boolean(e.walletNeutral);
  const isOrigin = Boolean(e.isDebtOrigin);
  const isIncome = e.amount < 0;

  if (isOrigin) return isIncome ? 'originBorrow' : 'originLend';
  if (walletNeutral) {
    if (name.startsWith('Gift to ')) return 'gift';
    return 'offsetIn';
  }
  if (name.startsWith('Offset to ')) return 'offsetOut';
  return isIncome ? 'repaidIn' : 'repaidOut';
}

const DEBT_META: Record<
  DebtClass,
  { badge: string; isWalletNeutral: boolean }
> = {
  originLend: { badge: 'Lent out', isWalletNeutral: false },
  originBorrow: { badge: 'Borrowed', isWalletNeutral: false },
  repaidIn: { badge: 'Received', isWalletNeutral: false },
  repaidOut: { badge: 'Paid back', isWalletNeutral: false },
  offsetIn: { badge: 'Offset in', isWalletNeutral: true },
  offsetOut: { badge: 'Offset out', isWalletNeutral: false },
  gift: { badge: 'Gift', isWalletNeutral: true },
};

type MergedItem =
  | { kind: 'expense'; record: ExpenseRecord; timestamp: string }
  | { kind: 'transfer'; record: TransferRecord; timestamp: string };

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  expenses,
  transfers = [],
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

  const handleEdit = (expense: ExpenseRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(expense);
  };

  const merged: MergedItem[] = [
    ...expenses.map((e) => ({ kind: 'expense' as const, record: e, timestamp: e.timestamp })),
    ...transfers.map((t) => ({ kind: 'transfer' as const, record: t, timestamp: t.timestamp })),
  ].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  if (merged.length === 0) {
    return (
      <div className="w-full text-center py-8 px-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-slate-500">
        <p className="text-xs font-medium">No activity logged yet.</p>
        <p className="text-[11px] text-slate-600 mt-0.5">
          Enter an amount above to record your first transaction.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Recent activity
        </h2>
        <span className="text-[11px] font-mono text-slate-500">
          {merged.length} recorded
        </span>
      </div>

      <div className="space-y-1.5">
        {merged.slice(0, 15).map((item) => {
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
          const debtClass = classifyDebtExpense(expense);
          const debtMeta = debtClass ? DEBT_META[debtClass] : null;
          const isWalletNeutral = debtMeta?.isWalletNeutral ?? false;
          const isIncome = expense.amount < 0;

          let displayAmount: string;
          let amountColor: string;
          let amountHint: string | null = null;

          if (debtClass) {
            if (isWalletNeutral) {
              displayAmount = formatCurrency(Math.abs(expense.amount), expense.currency);
              amountColor = 'text-slate-400';
              amountHint = 'no wallet change';
            } else {
              displayAmount = `${isIncome ? '+' : '−'}${formatCurrency(
                Math.abs(expense.amount),
                expense.currency
              )}`;
              amountColor = isIncome ? 'text-emerald-300' : 'text-rose-300';
            }
          } else {
            displayAmount = formatCurrency(expense.amount, expense.currency);
            amountColor = 'text-white';
          }

          let icon: React.ReactNode;
          if (debtClass === 'offsetIn' || debtClass === 'gift') {
            icon = <Gift className="w-3.5 h-3.5 text-purple-400" />;
          } else if (debtClass) {
            icon = <HandCoins className="w-3.5 h-3.5 text-purple-400" />;
          } else {
            icon = CATEGORY_ICONS[expense.category] || <MoreHorizontal className="w-3.5 h-3.5" />;
          }

          return (
            <div
              key={expense.id}
              className={cn(
                'group flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-900 transition-all border',
                debtClass && isWalletNeutral
                  ? 'border-purple-500/20 border-dashed hover:border-purple-500/40'
                  : debtClass
                    ? 'border-purple-500/30 hover:border-purple-500/50'
                    : 'border-slate-800/80 hover:border-slate-700/80'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border',
                    debtClass
                      ? 'bg-purple-500/10 border-purple-500/30'
                      : 'bg-slate-800/90 border-slate-700/50'
                  )}
                >
                  {icon}
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
                    {debtMeta && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-300 font-medium">
                        {debtMeta.badge}
                      </span>
                    )}
                    {!isWalletNeutral && (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.2 rounded-md font-medium flex items-center gap-0.5',
                          isCash
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-cyan-500/10 text-cyan-400'
                        )}
                        title={isCash ? 'Cash' : 'Bank / card'}
                      >
                        {isCash ? (
                          <Banknote className="w-2.5 h-2.5" />
                        ) : (
                          <Wallet className="w-2.5 h-2.5" />
                        )}
                        {isCash ? 'Cash' : 'Card'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                    <span>{formatRelativeTime(expense.timestamp)}</span>
                    <span>•</span>
                    <span
                      className="flex items-center gap-1"
                      title={
                        expense.isSynced
                          ? 'Synced with cloud'
                          : 'Saved locally offline in Dexie'
                      }
                    >
                      {expense.isSynced ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Clock className="w-3 h-3 text-slate-500" />
                      )}
                      <span className="text-[10px]">
                        {expense.isSynced ? 'Synced' : 'Offline'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                <div className="text-right">
                  <p className={cn('text-sm font-bold font-mono tracking-tight', amountColor)}>
                    {displayAmount}
                  </p>
                  {isForeignCurrency && (
                    <p className="text-[10px] font-mono text-emerald-400 font-medium">
                      ≈ {formatCurrency(expense.amountInALL, 'ALL')}
                    </p>
                  )}
                  {amountHint && (
                    <p className="text-[9px] text-slate-600 font-medium italic">
                      {amountHint}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-0.5">
                  {!debtClass && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};