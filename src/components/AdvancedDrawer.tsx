import React, { useState } from 'react';
import {
  X,
  Store,
  Coffee,
  ShoppingBag,
  Croissant,
  UtensilsCrossed,
  Tag,
  Check,
  Sparkles,
  Utensils,
  Lightbulb,
  Bus,
  Users,
  Plane,
  MoreHorizontal,
  Minus,
  Plus,
} from 'lucide-react';
import {
  type Category,
  CATEGORIES,
  type FoodType,
  FOOD_TYPES,
  type VendorType,
  VENDORS,
} from '../types';
import { useHistoricalSuggestions, type ItemSuggestion } from '../hooks/useHistoricalSuggestions';

import { cn } from '../utils/cn';

interface AdvancedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  setItemName: (val: string) => void;
  category: Category;
  setCategory: (val: Category) => void;
  vendorType?: VendorType;
  setVendorType: (val: VendorType | undefined) => void;
  foodType?: FoodType;
  setFoodType: (val: FoodType | undefined) => void;
  estimatedMeals?: number;
  setEstimatedMeals: (val: number | undefined) => void;
  onApplyAndClose?: () => void;
}

const VENDOR_ICONS: Record<VendorType, React.ReactNode> = {
  Pazar: <Store className="w-3.5 h-3.5" />,
  Supermarket: <ShoppingBag className="w-3.5 h-3.5" />,
  Café: <Coffee className="w-3.5 h-3.5" />,
  Bakery: <Croissant className="w-3.5 h-3.5" />,
  Restaurant: <UtensilsCrossed className="w-3.5 h-3.5" />,
  Other: <Tag className="w-3.5 h-3.5" />,
};

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  Food: <Utensils className="w-3.5 h-3.5 text-emerald-400" />,
  Utilities: <Lightbulb className="w-3.5 h-3.5 text-amber-400" />,
  Transport: <Bus className="w-3.5 h-3.5 text-cyan-400" />,
  Social: <Users className="w-3.5 h-3.5 text-purple-400" />,
  Travel: <Plane className="w-3.5 h-3.5 text-rose-400" />,
  Other: <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />,
};

export const AdvancedDrawer: React.FC<AdvancedDrawerProps> = ({
  isOpen,
  onClose,
  itemName,
  setItemName,
  category,
  setCategory,
  vendorType,
  setVendorType,
  foodType,
  setFoodType,
  estimatedMeals,
  setEstimatedMeals,
  onApplyAndClose,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = useHistoricalSuggestions(itemName);

  if (!isOpen) return null;

  const handleSelectSuggestion = (s: ItemSuggestion) => {
    setItemName(s.itemName);
    if (s.category) setCategory(s.category);
    if (s.vendorType) setVendorType(s.vendorType);
    if (s.foodType) setFoodType(s.foodType);
    setShowSuggestions(false);
  };

  const handleClearDetails = () => {
    setItemName('');
    setVendorType(undefined);
    setFoodType(undefined);
    setEstimatedMeals(undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-up Container */}
      <div className="relative w-full max-w-md bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto pb-10 z-10 animate-slide-up">
        {/* Grab Handle */}
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Advanced Details</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                Optional
              </span>
            </h2>
            <p className="text-xs text-slate-400">Add context to your expense</p>
          </div>
          <div className="flex items-center gap-2">
            {(itemName || vendorType || foodType || estimatedMeals) && (
              <button
                type="button"
                onClick={handleClearDetails}
                className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 pt-4">
          {/* Item Name Input with Smart Auto-suggestions */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Item Name / Description</span>
              </label>
              {suggestions.length > 0 && !showSuggestions && (
                <span className="text-[10px] text-slate-500">
                  {suggestions.length} past items found
                </span>
              )}
            </div>

            <input
              type="text"
              value={itemName}
              onChange={(e) => {
                setItemName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="e.g. Buka, Kafe me qumësht, Djathë..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
            />

            {/* Suggestions list */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="mt-2 p-2 bg-slate-950/90 rounded-2xl border border-slate-800/80 shadow-lg space-y-1">
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>Past Entries Auto-Suggest</span>
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    Hide
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {suggestions.map((s) => (
                    <button
                      key={s.itemName}
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-emerald-950/40 hover:border-emerald-500/50 border border-slate-700/60 text-xs text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{s.itemName}</span>
                      {s.vendorType && (
                        <span className="text-[10px] text-slate-400">
                          ({s.vendorType})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Category Assignment Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left',
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    )}
                  >
                    <span className="shrink-0">{CATEGORY_ICONS[cat]}</span>
                    <span className="truncate">{cat}</span>
                    {isSelected && <Check className="w-3 h-3 ml-auto text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vendor Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Vendor Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {VENDORS.map((v) => {
                const isSelected = vendorType === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVendorType(isSelected ? undefined : v)}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
                      isSelected
                        ? 'bg-teal-500/15 border-teal-500 text-teal-300 shadow-sm shadow-teal-500/20'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    )}
                  >
                    <span>{VENDOR_ICONS[v]}</span>
                    <span className="truncate">{v}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Food Type & Estimated Meals (Shown for Food or food vendors) */}
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-emerald-400" />
                <span>Food & Nutrition Details</span>
              </span>
              <span className="text-[10px] text-slate-500">Peace Corps Per-Meal Tracker</span>
            </div>

            <div>
              <p className="text-[11px] text-slate-400 mb-1.5 font-medium">Food Classification</p>
              <div className="grid grid-cols-2 gap-2">
                {FOOD_TYPES.map((ft) => {
                  const isSelected = foodType === ft;
                  return (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => setFoodType(isSelected ? undefined : ft)}
                      className={cn(
                        'px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer text-center',
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500/80 text-emerald-300'
                          : 'bg-slate-900 border-slate-800/80 text-slate-400 hover:text-slate-200'
                      )}
                    >
                      {ft}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Estimated Meals */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] text-slate-400 font-medium">Estimated Meals Provided</p>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {estimatedMeals !== undefined ? `${estimatedMeals} ${estimatedMeals === 1 ? 'meal' : 'meals'}` : 'Unspecified'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 rounded-xl border border-slate-800 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = estimatedMeals || 0;
                      if (cur > 1) setEstimatedMeals(cur - 1);
                      else setEstimatedMeals(undefined);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-white font-mono">
                    {estimatedMeals ?? '-'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = estimatedMeals || 0;
                      setEstimatedMeals(cur + 1);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick meal pills */}
                <div className="flex items-center gap-1.5 flex-1 overflow-x-auto py-0.5">
                  {[1, 2, 3, 5].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setEstimatedMeals(count)}
                      className={cn(
                        'px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer',
                        estimatedMeals === count
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      )}
                    >
                      {count}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={() => {
              if (onApplyAndClose) onApplyAndClose();
              else onClose();
            }}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Apply Details</span>
          </button>
        </div>
      </div>
    </div>
  );
};
