// src/components/RecentTransactions.tsx
import React, { useMemo } from 'react';
import {
  Trash2,
  CheckCircle2,
  Clock,
  Utensils,
  Lightbulb,
  Bus,
  Users,
  Plane,
  MoreHorizontal,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  HandCoins,
  Gift,
  PlusCircle,
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
  Food: <Utensils className="w-3.5 h-3.5 text-slate-600" />,
  Utilities: <Lightbulb className="w-3.5 h-3.5 text-slate-600" />,
  Transport: <Bus className="w-3.5 h-3.5 text-slate-600" />,
  Social: <Users className="w-3.5 h-3.5 text-slate-600" />,
  Travel: <Plane className="w-3.5 h-3.5 text-slate-600" />,
  Other: <MoreHorizontal className="w-3.5 h-3.5 text-slate-600" />,
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

function dayKey(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  const todayKey = dayKey(today.toISOString());
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yestKey = dayKey(yest.toISOString());
  if (key === todayKey) return 'Today';
  if (key === yestKey) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

type DebtClass =
  | 'originLend'
  | 'originBorrow'
  | 'repaidIn'
  | 'repaidOut'
  | 'offsetIn'
  | 'offsetOut'
  | 'gift'
  | 'splitMine'
  | 'splitTheirs';

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
    return 'splitTheirs';
  }
  if (name.startsWith('Offset to ')) return 'offsetOut';
  if (isIncome) return 'repaidIn';
  
  // If it's linked to a debt but not an origin, and not wallet neutral, it's likely your share of a split
  return 'splitMine';
}

const DEBT_META: Record<DebtClass, { badge: string; isWalletNeutral: boolean }> = {
  originLend: { badge: 'Lent out', isWalletNeutral: false },
  originBorrow: { badge: 'Borrowed', isWalletNeutral: false },
  repaidIn: { badge: 'Received', isWalletNeutral: false },
  repaidOut: { badge: 'Paid back', isWalletNeutral: false },
  offsetIn: { badge: 'Offset in', isWalletNeutral: true },
  offsetOut: { badge: 'Offset out', isWalletNeutral: false },
  gift: { badge: 'Gift', isWalletNeutral: true },
  splitMine: { badge: 'Your share', isWalletNeutral: true }, 
  splitTheirs: { badge: 'Their share', isWalletNeutral: true },
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

  const handleRowClick = (expense: ExpenseRecord) => {
    if (onEdit) onEdit(expense);
  };

  const merged: MergedItem[] = useMemo(() => {
    return [
      ...expenses.map((e) => ({ kind: 'expense' as const, record: e, timestamp: e.timestamp })),
      ...transfers.map((t) => ({ kind: 'transfer' as const, record: t, timestamp: t.timestamp })),
    ].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }, [expenses, transfers]);

  const grouped = useMemo(() => {
    const visible = merged.slice(0, 15);
    const groups: { key: string; label: string; items: MergedItem[]; total: number }[] = [];
    const index = new Map<string, number>();
    for (const item of visible) {
      const key = dayKey(item.timestamp);
      if (!index.has(key)) {
        index.set(key, groups.length);
        groups.push({ key, label: dayLabel(key), items: [], total: 0 });
      }
      const g = groups[index.get(key)!];
      g.items.push(item);
      if (item.kind === 'expense') {
        const e = item.record;
        if (e.amount > 0 && !e.debtRelated && !e.isDebtOrigin) {
          g.total += e.budgetAmountALL ?? e.amountInALL;
        }
      }
    }
    return groups;
  }, [merged]);

  if (merged.length === 0) {
    return (
      <div className="w-full text-center py-8 px-4 rounded-2xl bg-white border border-slate-200 border-dashed">
        <p className="text-xs font-medium text-slate-500">No activity logged yet.</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Enter an amount above to record your first transaction.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Recent activity
        </h2>
        <span className="text-[11px] font-mono text-slate-400">
          {merged.length} recorded
        </span>
      </div>

      {grouped.map((group) => (
        <div key={group.key} className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {group.label}
            </h3>
            {group.total > 0 && (
              <span className="text-[10px] font-mono text-slate-400">
                {formatCurrency(group.total, 'ALL')}
              </span>
            )}
          </div>

          {group.items.map((item) => {
            if (item.kind === 'transfer') {
              const t = item.record;
              const label = t.direction === 'BankToCash' ? 'Bank → Cash' : 'Cash → Bank';
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-amber-700 truncate">
                        {label}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span>{formatRelativeTime(t.timestamp)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {t.isSynced ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Clock className="w-3 h-3 text-slate-400" />
                          )}
                          <span className="text-[10px]">
                            {t.isSynced ? 'Synced' : 'Offline'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <p className="text-sm font-bold font-mono text-amber-700 tracking-tight">
                      {formatCurrency(t.amountALL, 'ALL')}
                    </p>
                    <div className="flex items-center justify-center w-[26px]">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTransfer(t.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                        title="Delete transfer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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

            const theme = debtClass
              ? { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: 'text-indigo-500' }
              : isCash
                ? { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', icon: 'text-teal-600' }
                : { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: 'text-rose-500' };

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
                amountColor = isIncome ? 'text-emerald-600' : 'text-rose-600';
              }
            } else {
              displayAmount = formatCurrency(expense.amount, expense.currency);
              amountColor = expense.amount < 0 ? 'text-emerald-600' : 'text-slate-900';
            }

            let icon: React.ReactNode;
            if (debtClass === 'offsetIn' || debtClass === 'gift') {
              icon = <Gift className={cn('w-3.5 h-3.5', theme.icon)} />;
            } else if (debtClass) {
              icon = <HandCoins className={cn('w-3.5 h-3.5', theme.icon)} />;
            } else if (expense.amount < 0) {
              icon = <PlusCircle className={cn('w-3.5 h-3.5', theme.icon)} />;
            } else {
              icon = CATEGORY_ICONS[expense.category] || <MoreHorizontal className="w-3.5 h-3.5" />;
            }

            return (
              <div
                key={expense.id}
                onClick={() => handleRowClick(expense)}
                className={cn(
                  'flex items-center justify-between p-3 rounded-2xl bg-white transition-all border shadow-sm cursor-pointer hover:border-emerald-300 hover:shadow-md',
                  isWalletNeutral ? 'border-dashed border-slate-300' : 'border-slate-200'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border',
                      debtClass ? cn(theme.bg, theme.border) : expense.amount < 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200'
                    )}
                  >
                    {icon}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {expense.itemName || (expense.amount < 0 ? 'Income' : expense.category)}
                      </span>
                      {expense.vendorType && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-500 font-medium">
                          {expense.vendorType}
                        </span>
                      )}
                      {expense.estimatedMeals && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                          {expense.estimatedMeals} meal{expense.estimatedMeals > 1 ? 's' : ''}
                        </span>
                      )}
                      {debtMeta && (
                        <span className={cn('text-[10px] px-1.5 py-0.2 rounded-md font-medium', theme.bg, theme.text)}>
                          {debtMeta.badge}
                        </span>
                      )}
                      {!isWalletNeutral && !debtClass && (
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.2 rounded-md font-medium flex items-center gap-0.5',
                            isCash ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'
                          )}
                          title={isCash ? 'Cash' : 'Bank / card'}
                        >
                          {isCash ? <Banknote className="w-2.5 h-2.5" /> : <CreditCard className="w-2.5 h-2.5" />}
                          {isCash ? 'Cash' : 'Card'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                      <span>{formatRelativeTime(expense.timestamp)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {expense.isSynced ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Clock className="w-3 h-3 text-slate-400" />
                        )}
                        <span className="text-[10px]">{expense.isSynced ? 'Synced' : 'Offline'}</span>
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
                      <p className="text-[10px] font-mono text-emerald-600 font-medium">
                        ≈ {formatCurrency(expense.amountInALL, 'ALL')}
                      </p>
                    )}
                    {amountHint && (
                      <p className="text-[9px] text-slate-400 font-medium italic">
                        {amountHint}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-center w-[26px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteExpense(expense.id, e);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
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
      ))}
    </div>
  );
};