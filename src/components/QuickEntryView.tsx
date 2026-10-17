// src/components/QuickEntryView.tsx
import React, { useState, useRef, useEffect } from 'react';
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
  Wallet,
  Banknote,
  ArrowLeftRight,
  HandCoins,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
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
import { CurrencyToggle } from './CurrencyToggle';
import { AdvancedDrawer } from './AdvancedDrawer';
import { RecentTransactions } from './RecentTransactions';
import { DebtsPanel } from './DebtsPanel';
import {
  addExpense,
  updateExpense,
  addTransfer,
  addDebt,
  settleDebtCash,
  getCounterparties,
} from '../db';
import { useExpenses } from '../hooks/useExpenses';
import { useTransfers } from '../hooks/useTransfers';
import { useDebts } from '../hooks/useDebts';
import { convertToALL, formatCurrency } from '../utils/currency';
import { dateToNoonISO, toDateInputValue } from '../utils/budget';
import { getVendorOptions, showFoodDetails } from '../utils/categoryConfig';
import { cn } from '../utils/cn';

type EntryMode = 'expense' | 'withdraw' | 'lend' | 'settle';

const MODES: { id: EntryMode; label: string; icon: React.ReactNode }[] = [
  { id: 'expense', label: 'Expense', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'withdraw', label: 'Withdraw', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  { id: 'lend', label: 'Lend', icon: <HandCoins className="w-3.5 h-3.5" /> },
  { id: 'settle', label: 'Settle', icon: <Check className="w-3.5 h-3.5" /> },
];

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  Food: <Utensils className="w-4 h-4 text-emerald-400" />,
  Utilities: <Lightbulb className="w-4 h-4 text-amber-400" />,
  Transport: <Bus className="w-4 h-4 text-cyan-400" />,
  Social: <Users className="w-4 h-4 text-purple-400" />,
  Travel: <Plane className="w-4 h-4 text-rose-400" />,
  Other: <MoreHorizontal className="w-4 h-4 text-slate-400" />,
};

export const QuickEntryView: React.FC = () => {
  const { expenses, totalSpentALL } = useExpenses();
  const { transfers } = useTransfers();
  const { openDebts } = useDebts();

  const [amountStr, setAmountStr] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>('ALL');
  const [mode, setMode] = useState<EntryMode>('expense');

  const [category, setCategory] = useState<Category>('Food');
  const [paidWith, setPaidWith] = useState<PaymentSource>('Cash');
  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const todayStr = toDateInputValue(new Date());

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [itemName, setItemName] = useState<string>('');
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
  const [lendSuggestions, setLendSuggestions] = useState<string[]>([]);

  const [settleDebtId, setSettleDebtId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalDateOverride, setOriginalDateOverride] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDebtsPanelOpen, setIsDebtsPanelOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    getCounterparties().then(setLendSuggestions);
  }, [openDebts.length]);

  const parsedAmount = parseFloat(amountStr) || 0;
  const normalizedALL = convertToALL(parsedAmount, currency);

  const shareAmount = parseFloat(shareAmountStr) || 0;
  const hasShare = shareAmount > 0 && shareCounterparty.trim().length > 0;

  const hasAdvancedData = Boolean(
    itemName.trim() || subcategory || vendorType || foodType || estimatedMeals || hasShare
  );

  const selectedDebt = openDebts.find((d) => d.id === settleDebtId);

  const isValid =
    parsedAmount > 0 &&
    (mode !== 'lend' || lendPerson.trim().length > 0) &&
    (mode !== 'settle' || selectedDebt !== undefined);

  const saveLabel = editingId
    ? 'Update Expense'
    : mode === 'expense'
      ? 'Save Expense'
      : mode === 'withdraw'
        ? 'Move Money'
        : mode === 'lend'
          ? 'Save Loan'
          : 'Settle Debt';

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

  const handleSubcategoryChange = (next: string | undefined) => {
    setSubcategory(next);
    const allowedVendors = getVendorOptions(category, next);
    if (vendorType && !allowedVendors.includes(vendorType)) {
      setVendorType(undefined);
    }
  };

  const handleQuickAdd = (inc: number) => {
    setAmountStr((prev) => {
      const current = parseFloat(prev) || 0;
      return (current + inc).toString();
    });
    inputRef.current?.focus();
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
    setSettleDebtId(null);
    inputRef.current?.focus();
  };

  const handleStartEdit = (expense: ExpenseRecord) => {
    if (expense.debtId) return;
    setMode('expense');
    setEditingId(expense.id);
    setAmountStr(String(expense.amount));
    setCurrency(expense.currency);
    setCategory(expense.category);
    setPaidWith(expense.paidWith ?? 'Card');
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
    setOriginalDateOverride(null);
    setDateOverride(null);
    handleResetForm();
  };

  const handleSelectDebt = (debtId: string) => {
    setSettleDebtId(debtId);
    const d = openDebts.find((x) => x.id === debtId);
    if (d && (!amountStr || parseFloat(amountStr) === 0)) {
      setAmountStr(String(d.remainingALL));
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
        const baseData: Partial<ExpenseRecord> & {
          amount: number;
          currency: Currency;
          category: Category;
          paidWith: PaymentSource;
          itemName?: string;
          subcategory?: string;
          vendorType?: VendorType;
          foodType?: FoodType;
          estimatedMeals?: number;
        } = {
          amount: parsedAmount,
          currency,
          category,
          paidWith,
          itemName: itemName.trim() || undefined,
          subcategory,
          vendorType,
          foodType,
          estimatedMeals,
        };

        if (editingId) {
          const updates: Partial<Omit<ExpenseRecord, 'id'>> = { ...baseData };
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

          if (hasShare && shareAmount < normalizedALL) {
            const saved = await addExpense({
              ...baseData,
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
            setFeedback(
              `Logged with ${formatCurrency(shareAmount, 'ALL')} owed to you in ${latencyMs}ms ⚡`
            );
          } else {
            await addExpense({ ...baseData, timestamp });
            const latencyMs = Math.round(performance.now() - startTime);
            setFeedback(
              dateOverride
                ? `Logged ${formatCurrency(parsedAmount, currency)} for ${dateOverride}`
                : `Logged ${formatCurrency(parsedAmount, currency)} in ${latencyMs}ms ⚡`
            );
          }
        }
        setEditingId(null);
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
          moveWalletWith: paidWith,
        });
        setFeedback(
          lendDirection === 'OwedToMe'
            ? `Lent ${formatCurrency(parsedAmount, 'ALL')} to ${lendPerson}`
            : `Borrowed ${formatCurrency(parsedAmount, 'ALL')} from ${lendPerson}`
        );
      } else if (mode === 'settle' && selectedDebt) {
        const settleAmount = Math.min(parsedAmount, selectedDebt.remainingALL);
        await settleDebtCash(selectedDebt.id, settleAmount, paidWith);
        setFeedback(
          selectedDebt.direction === 'OwedToMe'
            ? `Received ${formatCurrency(settleAmount, 'ALL')} from ${selectedDebt.counterparty}`
            : `Paid ${formatCurrency(settleAmount, 'ALL')} to ${selectedDebt.counterparty}`
        );
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
      <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/90 border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-400 font-medium">Logged Total</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-mono font-bold text-white tracking-tight">
            {formatCurrency(totalSpentALL, 'ALL')}
          </span>
          <span className="text-[10px] text-slate-500 ml-1.5 font-medium">
            ({expenses.length} logs)
          </span>
        </div>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSave}
        className="relative bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-2xl space-y-5"
      >
        {editingId && (
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-xs">
            <div className="flex items-center gap-1.5 text-amber-300 font-medium">
              <Pencil className="w-3.5 h-3.5" />
              <span>Editing expense</span>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-[11px] text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        )}

        <div className="flex justify-center">
          <CurrencyToggle selected={currency} onChange={setCurrency} />
        </div>

        <div className="text-center py-1">
          <div className="inline-flex items-baseline justify-center gap-2 max-w-full">
            {currency !== 'ALL' && (
              <span className="text-2xl font-mono font-medium text-slate-500 select-none">
                {currency === 'EUR' ? '€' : '$'}
              </span>
            )}
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              step="any"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0"
              className="w-full max-w-[280px] bg-transparent text-center font-mono text-5xl font-extrabold text-white placeholder-slate-700 focus:outline-none tracking-tight selection:bg-emerald-500/40"
              autoFocus
            />
          </div>

          {currency !== 'ALL' && parsedAmount > 0 && (
            <p className="text-xs font-mono text-emerald-400 mt-1 font-semibold">
              ≈ {formatCurrency(normalizedALL, 'ALL')} base Lek
            </p>
          )}

          <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
            {(currency === 'ALL' ? [50, 100, 200, 500, 1000] : [1, 2, 5, 10, 20]).map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => handleQuickAdd(step)}
                className="px-2.5 py-1 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/50 text-[11px] font-mono font-semibold text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
              >
                +{step}
              </button>
            ))}
            {parsedAmount > 0 && (
              <button
                type="button"
                onClick={() => setAmountStr('')}
                className="px-2 py-1 rounded-xl bg-slate-800/40 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-[11px] font-medium transition-colors cursor-pointer"
                title="Clear"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {!editingId && (
          <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-slate-950 border border-slate-800">
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
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'text-slate-500 hover:text-slate-300'
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
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Category
                </span>
                <span className="text-[11px] text-emerald-400 font-medium">
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
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 scale-[1.02]'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                      )}
                    >
                      <span className="shrink-0">{CATEGORY_ICONS[cat]}</span>
                      <span className="truncate">{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center">
              <div className="inline-flex p-1 rounded-2xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaidWith('Cash')}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                    paidWith === 'Cash'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-slate-400'
                  )}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaidWith('Card')}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                    paidWith === 'Card'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400'
                  )}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Card
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <CalendarDays className="w-3.5 h-3.5" />
                Date
              </span>
              <div className="flex items-center gap-2">
                {dateOverride && (
                  <button
                    type="button"
                    onClick={() => setDateOverride(null)}
                    className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
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
                    'bg-slate-950 border rounded-xl px-2.5 py-1.5 text-xs font-mono focus:outline-none',
                    dateOverride
                      ? 'border-amber-500/60 text-amber-300'
                      : 'border-slate-800 text-slate-300'
                  )}
                />
              </div>
            </div>

            {hasAdvancedData && (
              <div className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate text-slate-300 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {itemName || subcategory || 'Item'}{' '}
                    {vendorType ? `• ${vendorType}` : ''}{' '}
                    {estimatedMeals ? `• ${estimatedMeals} meal(s)` : ''}
                    {hasShare
                      ? ` • ${shareCounterparty} owes ${formatCurrency(shareAmount, 'ALL')}`
                      : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="text-[11px] text-emerald-400 hover:underline shrink-0 ml-2 cursor-pointer"
                >
                  Edit
                </button>
              </div>
            )}
          </>
        )}

        {mode === 'withdraw' && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Direction
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWithdrawDirection('BankToCash')}
                className={cn(
                  'p-3 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer',
                  withdrawDirection === 'BankToCash'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
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
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
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
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Person
              </p>
              <input
                type="text"
                value={lendPerson}
                onChange={(e) => setLendPerson(e.target.value)}
                placeholder="Who?"
                list="lekflow-lend-persons"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/70"
              />
              <datalist id="lekflow-lend-persons">
                {lendSuggestions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLendDirection('OwedToMe')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer',
                  lendDirection === 'OwedToMe'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
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
                    ? 'bg-rose-500/15 border-rose-500 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                )}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                They lent me
              </button>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Money moved via
              </p>
              <div className="inline-flex w-full p-1 rounded-2xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaidWith('Cash')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                    paidWith === 'Cash'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-slate-400'
                  )}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaidWith('Card')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                    paidWith === 'Card'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400'
                  )}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Bank
                </button>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Note (optional)
              </p>
              <input
                type="text"
                value={lendNote}
                onChange={(e) => setLendNote(e.target.value)}
                placeholder="What's it for?"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/70"
              />
            </div>
          </div>
        )}

        {mode === 'settle' && (
          <div className="space-y-3">
            {openDebts.length === 0 ? (
              <div className="text-center py-4 px-3 text-xs text-slate-500 rounded-xl bg-slate-950/60 border border-slate-800">
                No open debts. Use the Lend tab to create one first.
              </div>
            ) : (
              <>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Pick a debt
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {openDebts.map((d) => {
                    const selected = settleDebtId === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleSelectDebt(d.id)}
                        className={cn(
                          'w-full flex items-center justify-between p-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer',
                          selected
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/40 flex items-center justify-center shrink-0">
                            {d.direction === 'OwedToMe' ? (
                              <ArrowUpRight className="w-3 h-3 text-purple-400" />
                            ) : (
                              <ArrowDownLeft className="w-3 h-3 text-purple-400" />
                            )}
                          </div>
                          <div className="text-left min-w-0">
                            <p className="text-xs truncate">{d.counterparty}</p>
                            <p className="text-[10px] text-slate-500">
                              {d.direction === 'OwedToMe' ? 'owes you' : 'you owe'}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-mono shrink-0">
                          {formatCurrency(d.remainingALL, 'ALL')}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {selectedDebt && (
                  <>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Settled with
                      </p>
                      <div className="inline-flex w-full p-1 rounded-2xl bg-slate-950 border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setPaidWith('Cash')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                            paidWith === 'Cash'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'text-slate-400'
                          )}
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaidWith('Card')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                            paidWith === 'Card'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'text-slate-400'
                          )}
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          Bank
                        </button>
                      </div>
                    </div>

                    {parsedAmount > selectedDebt.remainingALL && (
                      <p className="text-[10px] text-amber-400 px-1">
                        Capped at remaining ({formatCurrency(selectedDebt.remainingALL, 'ALL')})
                      </p>
                    )}
                    {parsedAmount > 0 && parsedAmount < selectedDebt.remainingALL && (
                      <p className="text-[10px] text-amber-400 px-1">
                        Partial: {formatCurrency(parsedAmount, 'ALL')} of{' '}
                        {formatCurrency(selectedDebt.remainingALL, 'ALL')}
                      </p>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setIsDebtsPanelOpen(true)}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
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
              'w-full py-4 px-6 rounded-2xl font-bold text-base transition-all duration-150 flex items-center justify-center gap-2 shadow-xl cursor-pointer active:scale-[0.98]',
              isValid
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-emerald-500/25'
                : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed shadow-none'
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
              className="w-full py-3 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
              <span>Advanced Entry</span>
            </button>
          )}
        </div>

        {feedback && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-md bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 px-3 py-2 rounded-xl text-xs font-medium text-center shadow-xl backdrop-blur-md flex items-center justify-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            <span>{feedback}</span>
          </div>
        )}
      </form>

      <AdvancedDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        itemName={itemName}
        setItemName={setItemName}
        category={category}
        setCategory={handleCategoryChange}
        subcategory={subcategory}
        setSubcategory={handleSubcategoryChange}
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