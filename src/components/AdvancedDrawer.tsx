// src/components/AdvancedDrawer.tsx
import React, { useState, useEffect } from 'react';
import {
  Minus,
  Plus,
  X,
  HandCoins,
} from 'lucide-react';
import {
  FOOD_TYPES,
  type Category,
  type FoodType,
  type VendorType,
} from '../types';
import { getVendorOptions, showFoodDetails } from '../utils/categoryConfig';
import { getCounterparties } from '../db';
import { cn } from '../utils/cn';

interface AdvancedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category;
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

const MEAL_PRESETS = [1, 2, 3, 5, 7, 10, 14];

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

/**
 * Visible tappable suggestion chips that render below a text input.
 * Works on mobile — unlike <datalist>, which iOS/Android often ignore.
 */
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

export const AdvancedDrawer: React.FC<AdvancedDrawerProps> = ({
  isOpen,
  onClose,
  category,
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
  const [counterparties, setCounterparties] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    getCounterparties().then(setCounterparties);
  }, [isOpen]);

  const vendorOptions = getVendorOptions(category, undefined);
  const isFood = showFoodDetails(category);

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

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
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
                  <div className="flex gap-1.5 flex-wrap">
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
            <SuggestionChips
              options={counterparties}
              value={shareCounterparty}
              onSelect={setShareCounterparty}
            />
          </div>
        </div>

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