// src/hooks/useHistoricalSuggestions.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Category, Currency, FoodType, VendorType } from '../types';

export interface ItemSuggestion {
  itemName: string;
  category?: Category;
  vendorType?: VendorType;
  foodType?: FoodType;
  lastAmount?: number;
  lastCurrency?: Currency;
}

export function useHistoricalSuggestions(searchQuery: string = '') {
  const suggestions = useLiveQuery(
    async () => {
      const records = await db.expenses
        .filter((e) => Boolean(e.itemName && e.itemName.trim().length > 0))
        .reverse()
        .toArray();

      const map = new Map<string, ItemSuggestion>();
      for (const rec of records) {
        if (!rec.itemName) continue;
        const normalized = rec.itemName.trim();
        const key = normalized.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            itemName: normalized,
            category: rec.category,
            vendorType: rec.vendorType,
            foodType: rec.foodType,
            lastAmount: rec.amount,
            lastCurrency: rec.currency,
          });
        }
      }

      const all = Array.from(map.values());
      const query = searchQuery.trim().toLowerCase();
      if (!query) {
        return all.slice(0, 8);
      }

      return all
        .filter((item) => item.itemName.toLowerCase().includes(query))
        .slice(0, 8);
    },
    [searchQuery],
    [] as ItemSuggestion[]
  );

  return suggestions || [];
}