// LekFlow Data Schema Definitions

export type Currency = 'ALL' | 'EUR' | 'USD';

export type Category =
  | 'Food'
  | 'Utilities'
  | 'Transport'
  | 'Social'
  | 'Travel'
  | 'Other';

export type VendorType =
  | 'Pazar'
  | 'Supermarket'
  | 'Café'
  | 'Bakery'
  | 'Restaurant'
  | 'Other';

export type FoodType =
  | 'Grocery'
  | 'Ready Meal'
  | 'Snack'
  | 'Beverage';

export interface ExpenseRecord {
  id: string; // UUID / Dexie string id
  convexId?: string; // Convex document ID once synced
  amount: number; // Raw entered amount
  currency: Currency;
  amountInALL: number; // Normalized base amount for analytics
  category: Category;
  vendorType?: VendorType;
  foodType?: FoodType;
  itemName?: string;
  estimatedMeals?: number;
  timestamp: string; // ISO 8601 string: YYYY-MM-DDTHH:mm:ssZ
  isSynced: boolean; // Sync flag for offline engine
  updatedAt?: string; // ISO 8601 string for conflict resolution
  deleted?: boolean; // Soft-delete tombstone so deletions sync across devices
}

export interface BudgetCycle {
  id: string;
  startDate: string;
  targetEndDate: string;
  stipendAmountALL: number;
  startingRaiffeisenBalanceALL: number;
  bufferPoolALL: number;
  travelStashALL: number;
}

export interface ExchangeRates {
  EUR: number; // e.g. 1 EUR = 100 ALL
  USD: number; // e.g. 1 USD = 90 ALL
  ALL: number; // 1
}

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  EUR: 100,
  USD: 90,
  ALL: 1,
};

export const CATEGORIES: Category[] = [
  'Food',
  'Utilities',
  'Transport',
  'Social',
  'Travel',
  'Other',
];

export const VENDORS: VendorType[] = [
  'Pazar',
  'Supermarket',
  'Café',
  'Bakery',
  'Restaurant',
  'Other',
];

export const FOOD_TYPES: FoodType[] = [
  'Grocery',
  'Ready Meal',
  'Snack',
  'Beverage',
];