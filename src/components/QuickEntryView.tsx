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
} from 'lucide-react';
import {
  type Currency,
  type Category,
  CATEGORIES,
  type VendorType,
  type FoodType,
} from '../types';
import { CurrencyToggle } from './CurrencyToggle';
import { AdvancedDrawer } from './AdvancedDrawer';
import { RecentTransactions } from './RecentTransactions';
import { addExpense } from '../db';
import { useExpenses } from '../hooks/useExpenses';
import { convertToALL, formatCurrency } from '../utils/currency';
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

  // Core Quick Entry state
  const [amountStr, setAmountStr] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>('ALL');
  const [category, setCategory] = useState<Category>('Food');

  // Advanced Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [itemName, setItemName] = useState<string>('');
  const [vendorType, setVendorType] = useState<VendorType | undefined>(undefined);
  const [foodType, setFoodType] = useState<FoodType | undefined>(undefined);
  const [estimatedMeals, setEstimatedMeals] = useState<number | undefined>(undefined);

  // Success Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus numeric input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const parsedAmount = parseFloat(amountStr) || 0;
  const normalizedALL = convertToALL(parsedAmount, currency);

  // Has custom advanced data
  const hasAdvancedData = Boolean(
    itemName.trim() || vendorType || foodType || estimatedMeals
  );

  const handleQuickAdd = (inc: number) => {
    setAmountStr((prev) => {
      const current = parseFloat(prev) || 0;
      return (current + inc).toString();
    });
    inputRef.current?.focus();
  };

  const handleResetForm = () => {
    setAmountStr('');
    setItemName('');
    setVendorType(undefined);
    setFoodType(undefined);
    setEstimatedMeals(undefined);
    inputRef.current?.focus();
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

      await addExpense({
        amount: parsedAmount,
        currency,
        category,
        itemName: itemName.trim() || undefined,
        vendorType,
        foodType,
        estimatedMeals,
      });

      const latencyMs = Math.round(performance.now() - startTime);

      setFeedback(
        `Logged ${formatCurrency(parsedAmount, currency)} in ${latencyMs}ms ⚡ (Dexie local)`
      );
      setTimeout(() => setFeedback(null), 2500);

      // Reset form
      handleResetForm();
    } catch (err) {
      console.error('Failed to log expense locally:', err);
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
        onSubmit={handleSave}
        className="relative bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-2xl space-y-5"
      >
        {/* Currency Switcher */}
        <div className="flex justify-center">
          <CurrencyToggle selected={currency} onChange={setCurrency} />
        </div>

        {/* Big Numeric Amount Input */}
        <div className="text-center py-2">
          <div className="inline-flex items-baseline justify-center gap-2 max-w-full">
            <span className="text-2xl font-mono font-medium text-slate-500 select-none">
              {currency === 'ALL' ? 'L' : currency === 'EUR' ? '€' : '$'}
            </span>
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

          {/* Quick Increment Chips for Fast Offline Logging */}
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

        {/* Category Pills (Quick selection right on main screen) */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Category
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">
              {category}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
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

        {/* Advanced details preview pill (if user added details in drawer) */}
        {hasAdvancedData && (
          <div className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate text-slate-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">
                {itemName || 'Item'} {vendorType ? `• ${vendorType}` : ''}{' '}
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
          {/* Primary Action: Save Expense */}
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
            <span>Save Expense</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          {/* Secondary Action: Advanced Entry Toggle */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="w-full py-3 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span>Advanced Entry (Vendor, Item, Food)</span>
            {hasAdvancedData && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Instant Feedback Toast */}
        {feedback && (
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-11/12 bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 px-3 py-2 rounded-xl text-xs font-medium text-center shadow-xl backdrop-blur-md animate-fade-in flex items-center justify-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            <span>{feedback}</span>
          </div>
        )}
      </form>

      {/* Advanced Entry Slide-up Drawer */}
      <AdvancedDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        itemName={itemName}
        setItemName={setItemName}
        category={category}
        setCategory={setCategory}
        vendorType={vendorType}
        setVendorType={setVendorType}
        foodType={foodType}
        setFoodType={setFoodType}
        estimatedMeals={estimatedMeals}
        setEstimatedMeals={setEstimatedMeals}
        onApplyAndClose={() => setIsDrawerOpen(false)}
      />

      {/* Recent Transactions List from Dexie */}
      <RecentTransactions expenses={expenses} />
    </div>
  );
};
