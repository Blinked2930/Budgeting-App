import React from 'react';
import { Trash2, CheckCircle2, Clock, Utensils, Lightbulb, Bus, Users, Plane, MoreHorizontal } from 'lucide-react';
import type { ExpenseRecord, Category } from '../types';
import { formatCurrency } from '../utils/currency';
import { deleteExpense } from '../db';


interface RecentTransactionsProps {
  expenses: ExpenseRecord[];
  onDeleted?: () => void;
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

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  expenses,
  onDeleted,
}) => {
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteExpense(id);
    if (onDeleted) onDeleted();
  };

  if (!expenses || expenses.length === 0) {
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
          {expenses.length} recorded
        </span>
      </div>

      <div className="space-y-1.5">
        {expenses.slice(0, 10).map((expense) => {
          const isForeignCurrency = expense.currency !== 'ALL';

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

              <div className="flex items-center gap-3 shrink-0 ml-2">
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

                <button
                  type="button"
                  onClick={(e) => handleDelete(expense.id, e)}
                  className="opacity-40 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                  title="Delete record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
