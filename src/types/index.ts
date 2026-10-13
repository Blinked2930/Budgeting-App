// src/types/index.ts
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

/** Where money physically is when spent or held. */
export type PaymentSource = 'Cash' | 'Card';

/** Direction of a transfer between the two money sources. */
export type TransferDirection = 'BankToCash' | 'CashToBank';

export interface ExpenseRecord {
  id: string; // UUID / Dexie string id
  convexId?: string; // Convex document ID once synced
  amount: number; // Raw entered amount
  currency: Currency;
  amountInALL: number; // Normalized base amount for analytics
  category: Category;
  subcategory?: string;
  vendorType?: VendorType;
  foodType?: FoodType;
  itemName?: string;
  estimatedMeals?: number;
  timestamp: string; // ISO 8601 string: YYYY-MM-DDTHH:mm:ssZ
  paidWith?: PaymentSource; // Missing = 'Card' (legacy default)
  isSynced: boolean; // Sync flag for offline engine
  updatedAt?: string; // ISO 8601 string for conflict resolution
  deleted?: boolean; // Soft-delete tombstone so deletions sync across devices
}

/**
 * A transfer moves money between Bank and Cash without being spending.
 * Amounts are always positive; direction determines which way the money flows.
 *   BankToCash: bank goes down, cash goes up.
 *   CashToBank: cash goes down, bank goes up.
 */
export interface TransferRecord {
  id: string;
  convexId?: string;
  amountALL: number; // Always positive
  direction: TransferDirection;
  timestamp: string;
  isSynced: boolean;
  updatedAt?: string;
  deleted?: boolean;
}

export interface BudgetCycle {
  id: string;
  convexId?: string;
  startDate: string;
  targetEndDate: string;
  stipendAmountALL: number;
  startingRaiffeisenBalanceALL: number;
  startingCashALL?: number; // Missing = 0
  bufferPoolALL: number;
  travelStashALL: number;
  isSynced?: boolean;
  updatedAt?: string;
  deleted?: boolean;
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