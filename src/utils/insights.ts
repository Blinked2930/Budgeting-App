// src/utils/insights.ts
import type { Category, Currency, ExpenseRecord, FoodType, VendorType } from '../types';

export interface InsightFilters {
    vendor: VendorType | 'all';
    currency: Currency | 'all';
    month: string;
    foodType: FoodType | 'all';
}

export const DEFAULT_FILTERS: InsightFilters = {
    vendor: 'all',
    currency: 'all',
    month: 'all',
    foodType: 'all',
};

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

export function getMonthOptions(expenses: ExpenseRecord[]): string[] {
    const keys = new Set<string>();
    for (const e of expenses) {
        if (e.debtRelated) continue;
        keys.add(monthKey(e.timestamp));
    }
    return Array.from(keys).sort().reverse();
}

export function filterExpenses(
    expenses: ExpenseRecord[],
    filters: InsightFilters
): ExpenseRecord[] {
    return expenses.filter((e) => {
        if (e.debtRelated) return false;
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
    meals: number;
    mealSpend: number;
    costPerMeal: number | null;
}

export function aggregate(expenses: ExpenseRecord[]): Aggregate {
    let total = 0;
    let count = 0;
    let meals = 0;
    let mealSpend = 0;

    for (const e of expenses) {
        if (e.debtRelated) continue;
        const effectiveAmount = e.budgetAmountALL ?? e.amountInALL;
        total += effectiveAmount;
        count += 1;
        if (e.estimatedMeals && e.estimatedMeals > 0) {
            meals += e.estimatedMeals;
            mealSpend += effectiveAmount;
        }
    }

    return {
        total,
        count,
        average: count > 0 ? total / count : 0,
        meals,
        mealSpend,
        costPerMeal: meals > 0 ? mealSpend / meals : null,
    };
}

export interface MarketComparison {
    pazar: Aggregate;
    store: Aggregate;
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

// ---------- Category breakdown ----------

export interface CategoryStat {
    category: Category;
    total: number;
    count: number;
    /** 0–100. Sum of all stats' percents is 100 (or 0 if grandTotal is 0). */
    percent: number;
}

/**
 * Sum spending per category. Skips debt settlement rows (not consumption).
 * Uses budgetAmountALL ?? amountInALL so shared expenses count only your share.
 * Wallet-neutral gifts and offsets count — they're real budget consumption.
 */
export function aggregateByCategory(expenses: ExpenseRecord[]): CategoryStat[] {
    const map = new Map<Category, { total: number; count: number }>();
    let grandTotal = 0;

    for (const e of expenses) {
        if (e.debtRelated) continue;
        const amount = e.budgetAmountALL ?? e.amountInALL;
        const existing = map.get(e.category) ?? { total: 0, count: 0 };
        existing.total += amount;
        existing.count += 1;
        map.set(e.category, existing);
        grandTotal += amount;
    }

    return Array.from(map.entries())
        .filter(([, s]) => s.total > 0)
        .map(([category, s]) => ({
            category,
            total: s.total,
            count: s.count,
            percent: grandTotal > 0 ? (s.total / grandTotal) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);
}

// ---------- Cash vs card split ----------

export interface PaidWithStat {
    cash: number;
    card: number;
    cashPct: number;
    cardPct: number;
}

/**
 * Split total spending between cash and bank. Same exclusion rules as
 * aggregate — settlements skipped, budget-effective amounts used.
 */
export function aggregatePaidWith(expenses: ExpenseRecord[]): PaidWithStat {
    let cash = 0;
    let card = 0;

    for (const e of expenses) {
        if (e.debtRelated) continue;
        const amount = e.budgetAmountALL ?? e.amountInALL;
        if (e.paidWith === 'Cash') cash += amount;
        else card += amount;
    }

    const total = cash + card;
    return {
        cash,
        card,
        cashPct: total > 0 ? (cash / total) * 100 : 0,
        cardPct: total > 0 ? (card / total) * 100 : 0,
    };
}