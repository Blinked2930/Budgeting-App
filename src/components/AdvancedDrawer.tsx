// src/components/AdvancedDrawer.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Bus,
  Lightbulb,
  Minus,
  MoreHorizontal,
  Plane,
  Plus,
  Users,
  Utensils,
  X,
  HandCoins,
} from 'lucide-react';
import {
  CATEGORIES,
  FOOD_TYPES,
  type Category,
  type ExpenseRecord,
  type FoodType,
  type VendorType,
} from '../types';
import { useExpenses } from '../hooks/useExpenses';
import {
  CATEGORY_CONFIG,
  getSubcategories,
  getVendorOptions,
  showFoodDetails,
} from '../utils/categoryConfig';
import { getCounterparties } from '../db';
import { cn } from '../utils/cn';

interface AdvancedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  setItemName: (value: string) => void;
  category: Category;
  setCategory: (value: Category) => void;
  subcategory: string | undefined;
  setSubcategory: (value: string | undefined) => void;
  vendorType: VendorType | undefined;
  setVendorType: (value: VendorType | undefined) => void;
  foodType: FoodType | undefined;
  setFoodType: (value: FoodType | undefined) => void;
  estimatedMeals: number | undefined;
  setEstimatedMeals: (value: number | undefined) => void;
  shareCounterparty: string;
  setShareCounterparty: (value: string) => void;
  shareAmountStr: string;
  setShareAmountStr: (value: string) => void;
  onApplyAndClose: () => void;
  onClear: () => void;
}

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  Food: <Utensils className="w-3.5 h-3.5 text-slate-600" />,
  Utilities: <Lightbulb className="w-3.5 h-3.5 text-slate-600" />,
  Transport: <Bus className="w-3.5 h-3.5 text-slate-600" />,
  Social: <Users className="w-3.5 h-3.5 text-slate-600" />,
  Travel: <Plane className="w-3.5 h-3.5 text-slate-600" />,
  Other: <MoreHorizontal className="w-3.5 h-3.5 text-slate-600" />,
};

const MEAL_PRESETS = [1, 2, 3, 4, 6];

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

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
    {children}
  </p>
);

const Chip: React.FC<{
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer',
      selected
        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
        : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300'
    )}
  >
    {children}
  </button>
);

export const AdvancedDrawer: React.FC<AdvancedDrawerProps> = ({
  isOpen,
  onClose,
  itemName,
  setItemName,
  category,
  setCategory,
  subcategory,
  setSubcategory,
  vendorType,
  setVendorType,
  foodType,
  setFoodType,
  estimatedMeals,
  setEstimatedMeals,
  shareCounterparty,
  setShareCounterparty,
  shareAmountStr,
  setShareAmountStr,
  onApplyAndClose,
  onClear,
}) => {
  const { expenses } = useExpenses();
  const [isFocused, setIsFocused] = useState(false);
  const [counterparties, setCounterparties] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    getCounterparties().then(setCounterparties);
  }, [isOpen]);

  const config = CATEGORY_CONFIG[category];
  const subcategories = getSubcategories(category);
  const vendorOptions = getVendorOptions(category, subcategory);
  const isFood = showFoodDetails(category);

  const suggestions = useMemo(
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

  const toggle = <T,>(current: T | undefined, value: T, set: (v: T | undefined) => void) =>
    set(current === value ? undefined : value);

  const adjustMeals = (delta: number) => {
    const next = (estimatedMeals ?? 0) + delta;
    setEstimatedMeals(next > 0 ? next : undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-label="Advanced entry"
        className="relative w-full max-w-md flex flex-col max-h-[90vh] sm:max-h-[85vh] bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl"
      >
        {/* Header — fixed height, no shrink */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">Advanced entry</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content — min-h-0 is what makes this work */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <SectionLabel>Category</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <Chip key={cat} selected={category === cat} onClick={() => setCategory(cat)}>
                  {CATEGORY_ICONS[cat]}
                  {cat}
                </Chip>
              ))}
            </div>
          </div>

          {subcategories.length > 0 && (
            <div>
              <SectionLabel>Type of {category.toLowerCase()}</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {subcategories.map((sub: string) => (
                  <Chip
                    key={sub}
                    selected={subcategory === sub}
                    onClick={() => toggle(subcategory, sub, setSubcategory)}
                  >
                    {sub}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div>
            <SectionLabel>{config.itemLabel}</SectionLabel>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={config.itemPlaceholder}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
            />
            {suggestions.length > 0 && (isFocused || itemName.length === 0) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestions.map((s) => (
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

          {vendorOptions.length > 0 && (
            <div>
              <SectionLabel>Where?</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {vendorOptions.map((v: VendorType) => (
                  <Chip
                    key={v}
                    selected={vendorType === v}
                    onClick={() => toggle(vendorType, v, setVendorType)}
                  >
                    {v}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {isFood && (
            <>
              <div>
                <SectionLabel>What kind of food?</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {FOOD_TYPES.map((f) => (
                    <Chip
                      key={f}
                      selected={foodType === f}
                      onClick={() => toggle(foodType, f, setFoodType)}
                    >
                      {f}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>Meals this covers</SectionLabel>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustMeals(-1)}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                      aria-label="Fewer meals"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono text-base font-bold text-slate-900">
                      {estimatedMeals ?? '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustMeals(1)}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                      aria-label="More meals"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    {MEAL_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setEstimatedMeals(estimatedMeals === n ? undefined : n)}
                        className={cn(
                          'w-8 h-8 rounded-xl border text-xs font-mono font-semibold cursor-pointer transition-colors',
                          estimatedMeals === n
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Feeds the cost-per-meal numbers on the Insights tab.
                </p>
              </div>
            </>
          )}

          {/* Someone else's share — indigo to match debt theme */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center gap-1.5 mb-2">
              <HandCoins className="w-3.5 h-3.5 text-indigo-500" />
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Someone else's share
              </p>
            </div>
            <p className="text-[10px] text-slate-400 mb-2">
              If you covered part of this for someone, put their name and share here. Your budget will only count the rest, and they'll show up as owing you.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={shareCounterparty}
                onChange={(e) => setShareCounterparty(e.target.value)}
                placeholder="Name"
                list="lekflow-counterparties-share"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
              <datalist id="lekflow-counterparties-share">
                {counterparties.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={shareAmountStr}
                onChange={(e) => setShareAmountStr(e.target.value)}
                placeholder="Amount (L)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Footer — fixed height, no shrink */}
        <div
          className="shrink-0 px-5 pt-3 pb-4 border-t border-slate-200 grid grid-cols-3 gap-2"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={onClear}
            className="py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onApplyAndClose}
            className="col-span-2 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-bold cursor-pointer active:scale-[0.98] hover:bg-emerald-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};