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
} from 'lucide-react';
import {
  type Currency,
  type Category,
  CATEGORIES,
  type VendorType,
  type FoodType,
  type ExpenseRecord,
} from '../types';
import { CurrencyToggle } from './CurrencyToggle';
import { AdvancedDrawer } from './AdvancedDrawer';
import { RecentTransactions } from './RecentTransactions';
import { addExpense, updateExpense } from '../db';
import { useExpenses } from '../hooks/useExpenses';
import { convertToALL, formatCurrency } from '../utils/currency';
import { dateToNoonISO, toDateInputValue } from '../utils/budget';
import { getVendorOptions, showFoodDetails } from '../utils/categoryConfig';
import { cn } from '../utils/cn';

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

  const [amountStr, setAmountStr] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>('ALL');
  const [category, setCategory] = useState<Category>('Food');

  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const todayStr = toDateInputValue(new Date());

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [itemName, setItemName] = useState<string>('');
  const [subcategory, setSubcategory] = useState<string | undefined>(undefined);
  const [vendorType, setVendorType] = useState<VendorType | undefined>(undefined);
  const [foodType, setFoodType] = useState<FoodType | undefined>(undefined);
  const [estimatedMeals, setEstimatedMeals] = useState<number | undefined>(undefined);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalDateOverride, setOriginalDateOverride] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const parsedAmount = parseFloat(amountStr) || 0;
  const normalizedALL = convertToALL(parsedAmount, currency);

  const hasAdvancedData = Boolean(
    itemName.trim() || subcategory || vendorType || foodType || estimatedMeals
  );

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
  };

  const handleResetForm = () => {
    setAmountStr('');
    handleClearAdvanced();
    inputRef.current?.focus();
  };

  const handleStartEdit = (expense: ExpenseRecord) => {
    setEditingId(expense.id);
    setAmountStr(String(expense.amount));
    setCurrency(expense.currency);
    setCategory(expense.category);
    setItemName(expense.itemName ?? '');
    setSubcategory(expense.subcategory);
    setVendorType(expense.vendorType);
    setFoodType(expense.foodType);
    setEstimatedMeals(expense.estimatedMeals);

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

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!parsedAmount || parsedAmount <= 0) {
      inputRef.current?.focus();
      return;
    }

    try {
      setIsSaving(true);
      const startTime = performance.now();

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
        await addExpense({
          ...baseData,
          timestamp: dateOverride ? dateToNoonISO(dateOverride) : undefined,
        });

        const latencyMs = Math.round(performance.now() - startTime);
        setFeedback(
          dateOverride
            ? `Logged ${formatCurrency(parsedAmount, currency)} for ${dateOverride}`
            : `Logged ${formatCurrency(parsedAmount, currency)} in ${latencyMs}ms ⚡ (Dexie local)`
        );
      }

      setTimeout(() => setFeedback(null), 2500);

      setEditingId(null);
      setOriginalDateOverride(null);
      handleResetForm();
    } catch (err) {
      console.error('Failed to save expense:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 space-y-6">
      {/* Quick Summary Pill Banner */}
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

      {/* Main Entry Card */}
      <form
        ref={formRef}
        onSubmit={handleSave}
        className="relative bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-2xl space-y-5"
      >
        {/* Editing banner */}
        {editingId && (
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-xs">
            <div className="flex items-center gap-1.5 text-amber-300 font-medium">
              <Pencil className="w-3.5 h-3.5" />
              <span>Editing existing entry</span>
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

        {/* Currency Switcher */}
        <div className="flex justify-center">
          <CurrencyToggle selected={currency} onChange={setCurrency} />
        </div>

        {/* Big Numeric Amount Input — symbol hidden for ALL, shown for EUR/USD */}
        <div className="text-center py-2">
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

          {/* Realtime Lek Equivalent (if EUR or USD) */}
          {currency !== 'ALL' && parsedAmount > 0 && (
            <p className="text-xs font-mono text-emerald-400 mt-1 font-semibold animate-fade-in">
              ≈ {formatCurrency(normalizedALL, 'ALL')} base Lek
            </p>
          )}

          {/* Quick Increment Chips */}
          <div className="flex items-center justify-center gap-1.5 mt-4 flex-wrap">
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
                title="Clear input"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
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
              const isSelected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-2xl border text-xs font-semibold transition-all cursor-pointer text-left',
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10 scale-[1.02]'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  )}
                >
                  <span className="shrink-0">{CATEGORY_ICONS[cat]}</span>
                  <span className="truncate">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date */}
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
                Back to today
              </button>
            )}
            <input
              type="date"
              value={dateOverride ?? todayStr}
              max={todayStr}
              onChange={(e) => {
                const value = e.target.value;
                setDateOverride(value && value !== todayStr ? value : null);
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

        {/* Advanced details preview pill */}
        {hasAdvancedData && (
          <div className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate text-slate-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">
                {itemName || subcategory || 'Item'} {vendorType ? `• ${vendorType}` : ''}{' '}
                {estimatedMeals ? `• ${estimatedMeals} meal(s)` : ''}
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

        {/* Buttons Row */}
        <div className="space-y-2.5 pt-1">
          <button
            type="submit"
            disabled={!parsedAmount || parsedAmount <= 0 || isSaving}
            className={cn(
              'w-full py-4 px-6 rounded-2xl font-bold text-base transition-all duration-150 flex items-center justify-center gap-2 shadow-xl cursor-pointer active:scale-[0.98]',
              parsedAmount > 0
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-emerald-500/25 hover:opacity-95'
                : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed shadow-none'
            )}
          >
            <Zap className="w-5 h-5 fill-current" />
            <span>{editingId ? 'Update Expense' : 'Save Expense'}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="w-full py-3 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span>Advanced Entry</span>
          </button>
        </div>

        {/* Feedback Toast */}
        {feedback && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-md bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 px-3 py-2 rounded-xl text-xs font-medium text-center shadow-xl backdrop-blur-md animate-fade-in flex items-center justify-center gap-1.5">
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
        onApplyAndClose={() => setIsDrawerOpen(false)}
        onClear={handleClearAdvanced}
      />

      <RecentTransactions expenses={expenses} onEdit={handleStartEdit} />
    </div>
  );
};