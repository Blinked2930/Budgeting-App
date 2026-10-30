// src/types/index.ts
export type Currency = 'ALL' | 'EUR' | 'USD' | (string & {});

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
   * Falls back to amountInALL when undefined.
   */
  budgetAmountALL?: number;

  /** Links this expense to a debt. */
  debtId?: string;

  /** Marks a debt settlement — hits wallet, skips budget. */
  debtRelated?: boolean;

  /**
   * When true, this expense hits the budget but skips the wallet.
   * Used when writing off a standalone loan.
   */
  walletNeutral?: boolean;

  /**
   * True only for the initial wallet movement of a lend/borrow.
   * Hidden from the recent feed because the debt row already represents it.
   */
  isDebtOrigin?: boolean;

  /**
   * True for one-time big hits (rent, utilities, insurance) that were
   * already pre-budgeted via the cycle's planned big expenses.
   * Excluded from the daily allowance math, but still hits the wallet/remaining.
   */
  isBigExpense?: boolean;

  /**
   * True when this entry represents a debt that was forgiven. Counts as
   * an expense (the money is gone) even though no wallet moved.
   * Paired with walletNeutral: true.
   */
  isForgiveness?: boolean;

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

  /**
   * When someone else paid for a shared expense, this is the portion that
   * belongs to *you* (my share). The rest is the debt. Undefined for
   * regular lend/borrow debt.
   */
  myShareAmountALL?: number;

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

  /**
   * Total planned big expenses for the cycle (rent, bills, etc).
   * Subtracted from the cycle budget up front so the daily allowance
   * reflects reality from day one.
   */
  plannedBigExpensesALL?: number;

  isSynced?: boolean;
  updatedAt?: string;
  deleted?: boolean;
}

export interface ExchangeRates {
  EUR: number;
  USD: number;
  [key: string]: number;
}

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  ALL: 1,
  EUR: 100,
  USD: 90,
  GBP: 118,
  CHF: 105,
  CAD: 68,
  AUD: 60,
  JPY: 0.62,
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