// Convex & Dexie Data Schema Definitions

export interface ExpenseRecord {
  id: string; // UUID / Dexie Auto-id
  convexId?: string; // Convex document ID once synced
  amount: number; // Raw entered amount
  currency: 'ALL' | 'EUR' | 'USD';
  amountInALL: number; // Normalized base amount for analytics
  category: 'Food' | 'Utilities' | 'Transport' | 'Social' | 'Travel' | 'Other';
  vendorType?: 'Pazar' | 'Supermarket' | 'Café' | 'Bakery' | 'Restaurant' | 'Other';
  foodType?: 'Grocery' | 'Ready Meal' | 'Snack' | 'Beverage';
  itemName?: string;
  estimatedMeals?: number;
  timestamp: string; // ISO 8601 string: YYYY-MM-DDTHH:mm:ssZ
  isSynced: boolean; // Sync flag for offline engine
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