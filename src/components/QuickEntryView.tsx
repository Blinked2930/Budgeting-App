// src/components/QuickEntryView.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal,
  ArrowRight,
  Sparkles,
  Utensils,
  Lightbulb,
  Bus,
  Users,
  Plane,
  MoreHorizontal,
  RotateCcw,
  Zap,
  CalendarDays,
  Pencil,
  X,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  HandCoins,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  TriangleAlert,
  Handshake,
  Calculator,
} from 'lucide-react';
import {
  type Currency,
  type Category,
  CATEGORIES,
  type VendorType,
  type FoodType,
  type PaymentSource,
  type TransferDirection,
  type DebtDirection,
  type ExpenseRecord,
} from '../types';
import { AdvancedDrawer } from './AdvancedDrawer';
import { RecentTransactions } from './RecentTransactions';
import { DebtsPanel } from './DebtsPanel';
import {
  addExpense,
  updateExpense,
  addTransfer,
  addDebt,
  settleDebtCash,
} from '../db';
import { useExpenses } from '../hooks/useExpenses';
import { useTransfers } from '../hooks/useTransfers';
import { useDebts } from '../hooks/useDebts';
import { useBudgetCycle } from '../hooks/useBudgetCycle';
import { convertToALL, formatCurrency, evaluateAmountExpression } from '../utils/currency';
import { dateToNoonISO, toDateInputValue } from '../utils/budget';
import { getVendorOptions, showFoodDetails, CATEGORY_CONFIG } from '../utils/categoryConfig';
import { cn } from '../utils/cn';

type EntryMode = 'expense' | 'withdraw' | 'lend' | 'settle';
type PayMethod = 'Cash' | 'Card' | 'SomeoneElse';

const MODES: { id: EntryMode; label: string; icon: React.ReactNode }[] = [
  { id: 'expense', label: 'Expense', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'withdraw', label: 'Withdraw', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  { id: 'lend', label: 'Lend', icon: <HandCoins className="w-3.5 h-3.5" /> },
  { id: 'settle', label: 'Settle', icon: <Check className="w-3.5 h-3.5" /> },
];

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  Food: <Utensils className="w-4 h-4 text-slate-600" />,
  Utilities: <Lightbulb className="w-4 h-4 text-slate-600" />,
  Transport: <Bus className="w-4 h-4 text-slate-600" />,
  Social: <Users className="w-4 h-4 text-slate-600" />,
  Travel: <Plane className="w-4 h-4 text-slate-600" />,
  Other: <MoreHorizontal className="w-4 h-4 text-slate-600" />,
};

interface Suggestion {
  name: string;
  count: number;
  latest: ExpenseRecord;
}

function buildSuggestions(
  expenses: ExpenseRecord[],
  category: Category,
  query: string
): Suggestion[] {
  const byName = new Map<string, Suggestion>();

  for (const e of expenses) {
    if (e.category !== category || !e.itemName) continue;
    const name = e.itemName.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byName.set(key, { name, count: 1, latest: e });
    }
  }

  const q = query.trim().toLowerCase();
  return Array.from(byName.values())
    .filter((s) => {
      const lower = s.name.toLowerCase();
      return q ? lower.includes(q) && lower !== q : true;
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

const SuggestionChips: React.FC<{
  options: string[];
  value: string;
  onSelect: (value: string) => void;
}> = ({ options, value, onSelect }) => {
  const q = value.trim().toLowerCase();
  const filtered = options
    .filter((opt) => {
      const lower = opt.toLowerCase();
      return q ? lower.includes(q) && lower !== q : true;
    })
    .slice(0, 6);

  if (filtered.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {filtered.map((opt) => (
        <button
          key={opt}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(opt)}
          className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
        >
          {opt}
        </button>
      ))}
    </div>
  );
};

export const QuickEntryView: React.FC = () => {
  const { expenses, totalSpentALL } = useExpenses();
  const { transfers } = useTransfers();
  const { openDebts, debts } = useDebts();
  const { stats } = useBudgetCycle();

  const [amountStr, setAmountStr] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem('lekflow:currency');
    return (saved as Currency) || 'ALL';
  });
  const [mode, setMode] = useState<EntryMode>('expense');

  const [category, setCategory] = useState<Category>('Food');
  const [payMethod, setPayMethod] = useState<PayMethod>('Cash');
  const [payerName, setPayerName] = useState<string>('');

  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const todayStr = toDateInputValue(new Date());

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [itemName, setItemName] = useState<string>('');
  const [isItemFocused, setIsItemFocused] = useState(false);
  const [subcategory, setSubcategory] = useState<string | undefined>(undefined);
  const [vendorType, setVendorType] = useState<VendorType | undefined>(undefined);
  const [foodType, setFoodType] = useState<FoodType | undefined>(undefined);
  const [estimatedMeals, setEstimatedMeals] = useState<number | undefined>(undefined);
  const [shareCounterparty, setShareCounterparty] = useState<string>('');
  const [shareAmountStr, setShareAmountStr] = useState<string>('');

  const [withdrawDirection, setWithdrawDirection] = useState<TransferDirection>('BankToCash');

  const [lendPerson, setLendPerson] = useState<string>('');
  const [lendDirection, setLendDirection] = useState<DebtDirection>('OwedToMe');
  const [lendNote, setLendNote] = useState<string>('');

  const lendSuggestions = useMemo(() => {
    const names = new Set(debts.map((d) => d.counterparty));
    return Array.from(names).sort();
  }, [debts]);

  const debtGroups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; net: number; count: number }>();
    for (const d of openDebts) {
      let g = map.get(d.counterpartyKey);
      if (!g) {
        g = { key: d.counterpartyKey, name: d.counterparty, net: 0, count: 0 };
        map.set(d.counterpartyKey, g);
      }
      if (d.direction === 'OwedToMe') g.net += d.remainingALL;
      else g.net -= d.remainingALL;
      g.count++;
    }
    return Array.from(map.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [openDebts]);

  const [settleGroupKey, setSettleGroupKey] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingIsDebt, setEditingIsDebt] = useState<boolean>(false);
  const [originalDateOverride, setOriginalDateOverride] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDebtsPanelOpen, setIsDebtsPanelOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    const handleCurrencyChange = () => {
      const saved = localStorage.getItem('lekflow:currency');
      if (saved) setCurrency(saved as Currency);
    };
    window.addEventListener('lekflow:currency-changed', handleCurrencyChange);
    return () => window.removeEventListener('lekflow:currency-changed', handleCurrencyChange);
  }, []);

  const parsedAmount = useMemo(() => {
    if (!amountStr.trim()) return 0;
    if (/[+\-*/()]/.test(amountStr)) {
      const result = evaluateAmountExpression(amountStr);
      return result ?? 0;
    }
    const n = parseFloat(amountStr);
    return Number.isNaN(n) ? 0 : n;
  }, [amountStr]);

  const isExpression = /[+\-*/()]/.test(amountStr) && amountStr.trim().length > 0;
  const normalizedALL = convertToALL(parsedAmount, currency);

  const shareAmount = parseFloat(shareAmountStr) || 0;
  const hasShare = shareAmount > 0;

  const hasAdvancedData = Boolean(
    subcategory || vendorType || foodType || estimatedMeals
  );

  const selectedGroup = debtGroups.find((g) => g.key === settleGroupKey);

  const isValid =
    parsedAmount > 0 &&
    (mode !== 'expense' || payMethod !== 'SomeoneElse' || payerName.trim().length > 0) &&
    (mode !== 'lend' || lendPerson.trim().length > 0) &&
    (mode !== 'settle' || selectedGroup !== undefined);

  const saveLabel = editingId
    ? 'Update Expense'
    : mode === 'expense'
      ? 'Save Expense'
      : mode === 'withdraw'
        ? 'Move Money'
        : mode === 'lend'
          ? 'Save Loan'
          : 'Settle Debt';

  const itemSuggestions = useMemo(
    () => buildSuggestions(expenses, category, itemName),
    [expenses, category, itemName]
  );

  const applySuggestion = (s: Suggestion) => {
    setItemName(s.name);
    setSubcategory(s.latest.subcategory);
    setVendorType(s.latest.vendorType);
    setFoodType(s.latest.foodType);
    setEstimatedMeals(s.latest.estimatedMeals);
  };

  const handleModeChange = (next: EntryMode) => {
    if (editingId) return;
    setMode(next);
  };

  const handleCategoryChange = (next: Category) => {
    setCategory(next);
    setSubcategory(undefined);

    if (!showFoodDetails(next)) {
      setFoodType(undefined);
      setEstimatedMeals(undefined);
    }

    const allowedVendors = getVendorOptions(next, undefined);
    if (vendorType && !allowedVendors.includes(vendorType)) {
      setVendorType(undefined);
    }
  };

  const handleQuickAdd = (inc: number) => {
    setAmountStr((prev) => {
      const current = parseFloat(prev) || 0;
      return (current + inc).toString();
    });
  };

  const handleClearAdvanced = () => {
    setItemName('');
    setSubcategory(undefined);
    setVendorType(undefined);
    setFoodType(undefined);
    setEstimatedMeals(undefined);
    setShareCounterparty('');
    setShareAmountStr('');
  };

  const handleResetForm = () => {
    setAmountStr('');
    handleClearAdvanced();
    setLendPerson('');
    setLendNote('');
    setSettleGroupKey(null);
    setPayerName('');
    inputRef.current?.focus();
  };

  const handleStartEdit = (expense: ExpenseRecord) => {
    setMode('expense');
    setEditingId(expense.id);
    setEditingIsDebt(Boolean(expense.debtId));
    setAmountStr(String(expense.amount));
    setCategory(expense.category);
    setPayMethod((expense.paidWith as PayMethod) ?? 'Card');
    setItemName(expense.itemName ?? '');
    setSubcategory(expense.subcategory);
    setVendorType(expense.vendorType);
    setFoodType(expense.foodType);
    setEstimatedMeals(expense.estimatedMeals);
    setShareCounterparty('');
    setShareAmountStr('');

    const expenseDate = toDateInputValue(new Date(expense.timestamp));
    const override = expenseDate === todayStr ? null : expenseDate;
    setDateOverride(override);
    setOriginalDateOverride(override);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingIsDebt(false);
    setOriginalDateOverride(null);
    setDateOverride(null);
    handleResetForm();
  };

  const handleSelectGroup = (key: string) => {
    setSettleGroupKey(key);
    const g = debtGroups.find(x => x.key === key);
    if (g && (!amountStr || parseFloat(amountStr) === 0)) {
      setAmountStr(String(Math.abs(g.net)));
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValid) {
      inputRef.current?.focus();
      return;
    }

    try {
      setIsSaving(true);
      const startTime = performance.now();

      if (mode === 'expense') {
        const baseData = {
          amount: parsedAmount,
          currency,
          category,
          itemName: itemName.trim() || undefined,
          subcategory,
          vendorType,
          foodType,
          estimatedMeals,
        };

        if (editingId) {
          const updates: Partial<Omit<ExpenseRecord, 'id'>> = {
            ...baseData,
            paidWith: payMethod === 'SomeoneElse' ? 'Cash' : payMethod
          };
          const dateChanged = dateOverride !== originalDateOverride;
          if (dateChanged) {
            updates.timestamp = dateOverride
              ? dateToNoonISO(dateOverride)
              : new Date().toISOString();
          }
          await updateExpense(editingId, updates);
          const latencyMs = Math.round(performance.now() - startTime);
          setFeedback(`Updated in ${latencyMs}ms ⚡`);
        } else {
          const timestamp = dateOverride ? dateToNoonISO(dateOverride) : undefined;

          if (payMethod === 'SomeoneElse') {
            const myShareALL = hasShare ? shareAmount : undefined;

            await addDebt({
              counterparty: payerName.trim(),
              direction: 'iOwe',
              amountALL: normalizedALL,
              myShareAmountALL: myShareALL,
              purchaseDetails: {
                category,
                itemName: itemName.trim() || undefined,
              },
              timestamp,
            });
            const latencyMs = Math.round(performance.now() - startTime);
            setFeedback(
              hasShare
                ? `Logged ${formatCurrency(shareAmount, 'ALL')} for you + ${formatCurrency(normalizedALL - shareAmount, 'ALL')} owed to ${payerName} in ${latencyMs}ms ⚡`
                : `Logged ${formatCurrency(parsedAmount, currency)} paid by ${payerName} in ${latencyMs}ms ⚡`
            );
          } else if (hasShare && shareAmount < normalizedALL) {
            const saved = await addExpense({
              ...baseData,
              paidWith: payMethod as PaymentSource,
              budgetAmountALL: normalizedALL - shareAmount,
              timestamp,
            });
            await addDebt({
              counterparty: shareCounterparty,
              direction: 'OwedToMe',
              amountALL: shareAmount,
              sourceExpenseId: saved.id,
              note: itemName.trim() || undefined,
            });
            const latencyMs = Math.round(performance.now() - startTime);
            setFeedback(`Logged with ${formatCurrency(shareAmount, 'ALL')} owed to you in ${latencyMs}ms ⚡`);
          } else {
            await addExpense({
              ...baseData,
              paidWith: payMethod as PaymentSource,
              timestamp
            });
            const latencyMs = Math.round(performance.now() - startTime);
            setFeedback(
              dateOverride
                ? `Logged ${formatCurrency(parsedAmount, currency)} for ${dateOverride}`
                : `Logged ${formatCurrency(parsedAmount, currency)} in ${latencyMs}ms ⚡`
            );
          }
        }
        setEditingId(null);
        setEditingIsDebt(false);
        setOriginalDateOverride(null);
      } else if (mode === 'withdraw') {
        await addTransfer({
          amountALL: parsedAmount,
          direction: withdrawDirection,
        });
        setFeedback(
          `${withdrawDirection === 'BankToCash' ? 'Withdrew' : 'Deposited'} ${formatCurrency(
            parsedAmount,
            'ALL'
          )}`
        );
      } else if (mode === 'lend') {
        await addDebt({
          counterparty: lendPerson,
          direction: lendDirection,
          amountALL: parsedAmount,
          note: lendNote.trim() || undefined,
          moveWalletWith: payMethod === 'SomeoneElse' ? 'Cash' : (payMethod as PaymentSource),
        });
        setFeedback(
          lendDirection === 'OwedToMe'
            ? `Lent ${formatCurrency(parsedAmount, 'ALL')} to ${lendPerson}`
            : `Borrowed ${formatCurrency(parsedAmount, 'ALL')} from ${lendPerson}`
        );
      } else if (mode === 'settle' && settleGroupKey) {
        const personDebts = openDebts.filter(d => d.counterpartyKey === settleGroupKey);
        personDebts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        let remaining = parsedAmount;
        for (const d of personDebts) {
          if (remaining <= 0) break;
          const amt = Math.min(d.remainingALL, remaining);
          await settleDebtCash(d.id, amt, payMethod === 'SomeoneElse' ? 'Cash' : (payMethod as PaymentSource));
          remaining -= amt;
        }

        setFeedback(`Settled ${formatCurrency(parsedAmount, 'ALL')} with ${selectedGroup?.name}`);
      }

      setTimeout(() => setFeedback(null), 2500);
      handleResetForm();
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 space-y-6">
      
      {/* Unified Header */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')} />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Today
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={cn(
              "text-sm font-mono font-bold tracking-tight",
              stats && stats.spentToday > stats.dailyAllowance ? 'text-rose-600' : 'text-emerald-600'
            )}>
              {stats ? formatCurrency(stats.spentToday, 'ALL') : '—'}
            </span>
            <span className="text-[10px] text-slate-400">/ {stats ? formatCurrency(stats.dailyAllowance, 'ALL') : '—'}</span>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            All-time Total
          </p>
          <div className="text-right mt-0.5">
            <span className="text-sm font-mono font-bold text-slate-900 tracking-tight">
              {formatCurrency(totalSpentALL, 'ALL')}
            </span>
            <span className="text-[10px] text-slate-400 ml-1.5 font-medium">
              ({expenses.length})
            </span>
          </div>
        </div>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSave}
        className="relative bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-5"
      >
        {editingId && (
          <div className={cn(
            "flex flex-col gap-2 p-3 rounded-2xl border text-xs",
            editingIsDebt ? "bg-indigo-50 border-indigo-200" : "bg-amber-50 border-amber-200"
          )}>
            <div className="flex items-center justify-between">
              <div className={cn(
                "flex items-center gap-1.5 font-medium",
                editingIsDebt ? "text-indigo-700" : "text-amber-700"
              )}>
                <Pencil className="w-3.5 h-3.5" />
                <span>Editing {editingIsDebt ? 'debt entry' : 'expense'}</span>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className={cn(
                  "hover:underline cursor-pointer flex items-center gap-1",
                  editingIsDebt ? "text-indigo-700" : "text-amber-700"
                )}
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
            {editingIsDebt && (
              <div className="flex items-start gap-1.5 text-[10px] text-indigo-600/80">
                <TriangleAlert className="w-3 h-3 shrink-0 mt-0.5" />
                <p>This will update the wallet movement. The debt balance itself is managed in the Debts panel.</p>
              </div>
            )}
          </div>
        )}

        <div className="text-center py-1">
          <div className="inline-flex items-baseline justify-center gap-2 max-w-full">
            {currency !== 'ALL' && (
              <span className="text-2xl font-mono font-medium text-slate-400 select-none">
                {currency === 'EUR' ? '€' : '$'}
              </span>
            )}
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0"
              className="w-full max-w-[280px] bg-transparent text-center font-mono text-5xl font-extrabold text-slate-900 placeholder-slate-300 focus:outline-none tracking-tight selection:bg-emerald-500/20"
              autoFocus
            />
          </div>

          {isExpression && parsedAmount > 0 && (
            <p className="text-xs font-mono text-emerald-600 mt-1 font-semibold flex items-center justify-center gap-1">
              <Calculator className="w-3 h-3" />= {formatCurrency(parsedAmount, currency)}
            </p>
          )}

          {!isExpression && currency !== 'ALL' && parsedAmount > 0 && (
            <p className="text-xs font-mono text-emerald-600 mt-1 font-semibold">
              ≈ {formatCurrency(normalizedALL, 'ALL')} base Lek
            </p>
          )}

          <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
            {(currency === 'ALL' ? [50, 100, 200, 500, 1000] : [1, 2, 5, 10, 20]).map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => handleQuickAdd(step)}
                className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-[11px] font-mono font-semibold text-slate-600 transition-all cursor-pointer active:scale-95"
              >
                +{step}
              </button>
            ))}
            {parsedAmount > 0 && (
              <button
                type="button"
                onClick={() => setAmountStr('')}
                className="px-2 py-1 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 text-[11px] font-medium transition-colors cursor-pointer"
                title="Clear"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {!editingId && (
          <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200">
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleModeChange(m.id)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer',
                    active
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {mode === 'expense' && (
          <>
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Category
                </span>
                <span className="text-[11px] text-emerald-600 font-medium">
                  {subcategory ? `${category} · ${subcategory}` : category}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => {
                  const selected = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategoryChange(cat)}
                      className={cn(
                        'flex items-center gap-2 p-2.5 rounded-2xl border text-xs font-semibold transition-all cursor-pointer text-left',
                        selected
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
                      )}
                    >
                      <span className="shrink-0">{CATEGORY_ICONS[cat]}</span>
                      <span className="truncate">{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                onFocus={() => setIsItemFocused(true)}
                onBlur={() => setIsItemFocused(false)}
                placeholder={CATEGORY_CONFIG[category].itemPlaceholder}
                list="lekflow-item-names"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
              />
              <datalist id="lekflow-item-names">
                {itemSuggestions.map((s) => (
                  <option key={s.name} value={s.name} />
                ))}
              </datalist>
              {itemSuggestions.length > 0 && (isItemFocused || itemName.length === 0) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {itemSuggestions.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applySuggestion(s)}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                      title={`Used ${s.count} time${s.count === 1 ? '' : 's'}. Tap to reuse its details.`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayMethod('Cash')}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                    payMethod === 'Cash'
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-400'
                  )}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod('Card')}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                    payMethod === 'Card'
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-slate-400'
                  )}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Card
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod('SomeoneElse')}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                    payMethod === 'SomeoneElse'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-400'
                  )}
                >
                  <Handshake className="w-3.5 h-3.5" />
                  Someone else
                </button>
              </div>
            </div>

            {payMethod === 'SomeoneElse' && (
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="Who paid?"
                  list="lekflow-payer-names"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
                <datalist id="lekflow-payer-names">
                  {lendSuggestions.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <SuggestionChips
                  options={lendSuggestions}
                  value={payerName}
                  onSelect={setPayerName}
                />
                
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    value={shareCounterparty}
                    onChange={(e) => setShareCounterparty(e.target.value)}
                    placeholder="Whose share is it? (Optional)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={shareAmountStr}
                    onChange={(e) => setShareAmountStr(e.target.value)}
                    placeholder="Amount they paid for you (L)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>

                {hasShare && (
                  <p className="text-[10px] text-indigo-600 leading-relaxed px-1">
                    Your share: {formatCurrency(shareAmount, 'ALL')} · {payerName || 'They'}'s share: {formatCurrency(Math.max(0, normalizedALL - shareAmount), 'ALL')} · Owed to {payerName || 'them'}: {formatCurrency(Math.max(0, normalizedALL - shareAmount), 'ALL')}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <CalendarDays className="w-3.5 h-3.5" />
                Date
              </span>
              <div className="flex items-center gap-2">
                {dateOverride && (
                  <button
                    type="button"
                    onClick={() => setDateOverride(null)}
                    className="text-[11px] text-emerald-600 hover:underline cursor-pointer"
                  >
                    Today
                  </button>
                )}
                <input
                  type="date"
                  value={dateOverride ?? todayStr}
                  max={todayStr}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDateOverride(v && v !== todayStr ? v : null);
                  }}
                  className={cn(
                    'bg-slate-50 border rounded-xl px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:bg-white',
                    dateOverride
                      ? 'border-amber-400 text-amber-700'
                      : 'border-slate-200 text-slate-600'
                  )}
                />
              </div>
            </div>

            {hasAdvancedData && (
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate text-slate-600 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate">
                    {subcategory || 'Item'}{' '}
                    {vendorType ? `• ${vendorType}` : ''}{' '}
                    {estimatedMeals ? `• ${estimatedMeals} meal(s)` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="text-[11px] text-emerald-600 hover:underline shrink-0 ml-2 cursor-pointer"
                >
                  Edit
                </button>
              </div>
            )}
          </>
        )}

        {mode === 'withdraw' && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Direction
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWithdrawDirection('BankToCash')}
                className={cn(
                  'p-3 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer',
                  withdrawDirection === 'BankToCash'
                    ? 'bg-amber-50 border-amber-500 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-500'
                )}
              >
                Bank → Cash
              </button>
              <button
                type="button"
                onClick={() => setWithdrawDirection('CashToBank')}
                className={cn(
                  'p-3 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer',
                  withdrawDirection === 'CashToBank'
                    ? 'bg-amber-50 border-amber-500 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-500'
                )}
              >
                Cash → Bank
              </button>
            </div>
          </div>
        )}

        {mode === 'lend' && (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Person
              </p>
              <input
                type="text"
                value={lendPerson}
                onChange={(e) => setLendPerson(e.target.value)}
                placeholder="Who?"
                list="lekflow-lend-persons"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
              <datalist id="lekflow-lend-persons">
                {lendSuggestions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <SuggestionChips
                options={lendSuggestions}
                value={lendPerson}
                onSelect={setLendPerson}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLendDirection('OwedToMe')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer',
                  lendDirection === 'OwedToMe'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                    : 'bg-white border-slate-200 text-slate-500'
                )}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                I lent them
              </button>
              <button
                type="button"
                onClick={() => setLendDirection('iOwe')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer',
                  lendDirection === 'iOwe'
                    ? 'bg-rose-50 border-rose-500 text-rose-700'
                    : 'bg-white border-slate-200 text-slate-500'
                )}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                They lent me
              </button>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Money moved via
              </p>
              <div className="inline-flex w-full p-1 rounded-2xl bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayMethod('Cash')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                    payMethod === 'Cash'
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-400'
                  )}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod('Card')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                    payMethod === 'Card'
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-slate-400'
                  )}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Bank
                </button>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Note (optional)
              </p>
              <input
                type="text"
                value={lendNote}
                onChange={(e) => setLendNote(e.target.value)}
                placeholder="What's it for?"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>
        )}

        {mode === 'settle' && (
          <div className="space-y-3">
            {debtGroups.length === 0 ? (
              <div className="text-center py-4 px-3 text-xs text-slate-500 rounded-xl bg-slate-50 border border-slate-200">
                No open debts. Use the Lend or Expense tab to create one first.
              </div>
            ) : (
              <>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Who are you settling with?
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {debtGroups.map((g) => {
                    const selected = settleGroupKey === g.key;
                    return (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => handleSelectGroup(g.key)}
                        className={cn(
                          'w-full flex items-center justify-between p-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer',
                          selected
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-indigo-600">{g.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="text-left min-w-0">
                            <p className="text-xs truncate">{g.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {g.net > 0 ? 'owes you' : g.net < 0 ? 'you owe' : 'even'}
                            </p>
                          </div>
                        </div>
                        <p className={cn("text-sm font-mono shrink-0", g.net > 0 ? "text-emerald-600" : g.net < 0 ? "text-rose-600" : "text-slate-400")}>
                          {formatCurrency(Math.abs(g.net), 'ALL')}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {selectedGroup && (
                  <>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Settled with
                      </p>
                      <div className="inline-flex w-full p-1 rounded-2xl bg-slate-100 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setPayMethod('Cash')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                            payMethod === 'Cash'
                              ? 'bg-white text-teal-700 shadow-sm'
                              : 'text-slate-400'
                          )}
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayMethod('Card')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                            payMethod === 'Card'
                              ? 'bg-white text-rose-700 shadow-sm'
                              : 'text-slate-400'
                          )}
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Bank
                        </button>
                      </div>
                    </div>

                    {parsedAmount > Math.abs(selectedGroup.net) && (
                      <p className="text-[10px] text-amber-600 px-1">
                        Capped at balance ({formatCurrency(Math.abs(selectedGroup.net), 'ALL')})
                      </p>
                    )}
                    {parsedAmount > 0 && parsedAmount < Math.abs(selectedGroup.net) && (
                      <p className="text-[10px] text-amber-600 px-1">
                        Partial: {formatCurrency(parsedAmount, 'ALL')} of{' '}
                        {formatCurrency(Math.abs(selectedGroup.net), 'ALL')}
                      </p>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setIsDebtsPanelOpen(true)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                >
                  Manage all debts →
                </button>
              </>
            )}
          </div>
        )}

        <div className="space-y-2.5 pt-1">
          <button
            type="submit"
            disabled={!isValid || isSaving}
            className={cn(
              'w-full py-4 px-6 rounded-2xl font-bold text-base transition-all duration-150 flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-[0.98]',
              isValid
                ? 'bg-emerald-600 text-white shadow-emerald-500/20 hover:bg-emerald-700'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
            )}
          >
            <Zap className="w-5 h-5 fill-current" />
            <span>{saveLabel}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          {mode === 'expense' && (
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
              <span>Advanced Entry</span>
            </button>
          )}
        </div>

        {feedback && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-md bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-xl text-xs font-medium text-center shadow-xl flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-bottom-2">
            <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            <span>{feedback}</span>
          </div>
        )}
      </form>

      <AdvancedDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        category={category}
        vendorType={vendorType}
        setVendorType={setVendorType}
        foodType={foodType}
        setFoodType={setFoodType}
        estimatedMeals={estimatedMeals}
        setEstimatedMeals={setEstimatedMeals}
        shareCounterparty={shareCounterparty}
        setShareCounterparty={setShareCounterparty}
        shareAmountStr={shareAmountStr}
        setShareAmountStr={setShareAmountStr}
        onApplyAndClose={() => setIsDrawerOpen(false)}
        onClear={handleClearAdvanced}
      />

      <DebtsPanel isOpen={isDebtsPanelOpen} onClose={() => setIsDebtsPanelOpen(false)} />

      <RecentTransactions
        expenses={expenses}
        transfers={transfers}
        onEdit={handleStartEdit}
      />
    </div>
  );
};