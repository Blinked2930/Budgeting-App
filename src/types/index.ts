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

export type PaymentSource = 'Cash' | 'Card';

export type TransferDirection = 'BankToCash' | 'CashToBank';

export type DebtDirection = 'iOwe' | 'OwedToMe';

export interface ExpenseRecord {
  id: string;
  convexId?: string;
  amount: number;
  currency: Currency;
  amountInALL: number;
  category: Category;
  subcategory?: string;
  vendorType?: VendorType;
  foodType?: FoodType;
  itemName?: string;
  estimatedMeals?: number;
  timestamp: string;
  paidWith?: PaymentSource;

  /**
   * When set, this expense only counts this much against the budget.
   * Used when part of the payment was covering someone else's share.
   * Falls back to amountInALL when undefined.
   */
  budgetAmountALL?: number;

  /** Links this expense to a debt (as a settlement or as the original shared payment). */
  debtId?: string;

  /** Marks this expense as a debt settlement — hits wallet, skips budget. */
  debtRelated?: boolean;

  /**
   * When true, this expense hits the budget but skips the wallet entirely.
   * Used when writing off a standalone loan — the wallet already moved when
   * the money was lent, so absorbing the budget impact shouldn't move it again.
   */
  walletNeutral?: boolean;

  isSynced: boolean;
  updatedAt?: string;
  deleted?: boolean;
}

export interface TransferRecord {
  id: string;
  convexId?: string;
  amountALL: number;
  direction: TransferDirection;
  timestamp: string;
  isSynced: boolean;
  updatedAt?: string;
  deleted?: boolean;
}

export interface DebtRecord {
  id: string;
  convexId?: string;
  counterparty: string;
  counterpartyKey: string;
  direction: DebtDirection;
  amountALL: number;
  remainingALL: number;
  note?: string;
  status: 'open' | 'resolved';
  sourceExpenseId?: string;
  createdAt: string;
  resolvedAt?: string;
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
  startingCashALL?: number;
  bufferPoolALL: number;
  travelStashALL: number;
  isSynced?: boolean;
  updatedAt?: string;
  deleted?: boolean;
}

export interface ExchangeRates {
  EUR: number;
  USD: number;
  ALL: number;
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