import type { Currency, ExpenseRecord, FoodType, VendorType } from '../types';

export interface InsightFilters {
    vendor: VendorType | 'all';
    currency: Currency | 'all';
    /** 'all' or a YYYY-MM key */
    month: string;
    foodType: FoodType | 'all';
}

export const DEFAULT_FILTERS: InsightFilters = {
    vendor: 'all',
    currency: 'all',
    month: 'all',
    foodType: 'all',
};

/** Local-time YYYY-MM key for an ISO timestamp. */
export function monthKey(timestamp: string): string {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
    const [y, m] = key.split('-').map(Number);
    return new Date(y ?? 1970, (m ?? 1) - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
    });
}

/** Distinct months that have expenses, newest first. */
export function getMonthOptions(expenses: ExpenseRecord[]): string[] {
    const keys = new Set<string>();
    for (const e of expenses) keys.add(monthKey(e.timestamp));
    return Array.from(keys).sort().reverse();
}

export function filterExpenses(
    expenses: ExpenseRecord[],
    filters: InsightFilters
): ExpenseRecord[] {
    return expenses.filter((e) => {
        if (filters.vendor !== 'all' && e.vendorType !== filters.vendor) return false;
        if (filters.currency !== 'all' && e.currency !== filters.currency) return false;
        if (filters.foodType !== 'all' && e.foodType !== filters.foodType) return false;
        if (filters.month !== 'all' && monthKey(e.timestamp) !== filters.month) return false;
        return true;
    });
}

export interface Aggregate {
    total: number;
    count: number;
    average: number;
    /** Total estimated meals across entries that have a meal estimate. */
    meals: number;
    /** Spending on the entries that have a meal estimate. */
    mealSpend: number;
    /** mealSpend / meals, or null when no entry has a meal estimate. */
    costPerMeal: number | null;
}

export function aggregate(expenses: ExpenseRecord[]): Aggregate {
    let total = 0;
    let meals = 0;
    let mealSpend = 0;

    for (const e of expenses) {
        total += e.amountInALL;
        if (e.estimatedMeals && e.estimatedMeals > 0) {
            meals += e.estimatedMeals;
            mealSpend += e.amountInALL;
        }
    }

    return {
        total,
        count: expenses.length,
        average: expenses.length > 0 ? total / expenses.length : 0,
        meals,
        mealSpend,
        costPerMeal: meals > 0 ? mealSpend / meals : null,
    };
}

export interface MarketComparison {
    pazar: Aggregate;
    store: Aggregate;
    /**
     * How much cheaper (positive) or pricier (negative) Pazar is per meal
     * than the supermarket, as a percentage. Null if either side has no
     * meal estimates to compare.
     */
    pazarCheaperByPct: number | null;
}

export function compareMarkets(expenses: ExpenseRecord[]): MarketComparison {
    const pazar = aggregate(expenses.filter((e) => e.vendorType === 'Pazar'));
    const store = aggregate(expenses.filter((e) => e.vendorType === 'Supermarket'));

    let pazarCheaperByPct: number | null = null;
    if (pazar.costPerMeal !== null && store.costPerMeal !== null && store.costPerMeal > 0) {
        pazarCheaperByPct = ((store.costPerMeal - pazar.costPerMeal) / store.costPerMeal) * 100;
    }

    return { pazar, store, pazarCheaperByPct };
}