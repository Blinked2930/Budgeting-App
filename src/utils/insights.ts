// src/utils/insights.ts
import type { Category, ExpenseRecord, PaymentSource } from '../types';

export interface InsightFilters {
    category: Category | 'all';
    paidWith: PaymentSource | 'all';
    month: string;
}

export const DEFAULT_FILTERS: InsightFilters = {
    category: 'all',
    paidWith: 'all',
    month: 'all',
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
        if (e.debtRelated || e.walletNeutral) continue;
        keys.add(monthKey(e.timestamp));
    }
    return Array.from(keys).sort().reverse();
}

export function filterExpenses(
    expenses: ExpenseRecord[],
    filters: InsightFilters
): ExpenseRecord[] {
    return expenses.filter((e) => {
        if (e.debtRelated || e.walletNeutral) return false;
        if (filters.category !== 'all' && e.category !== filters.category) return false;
        if (filters.paidWith !== 'all' && (e.paidWith ?? 'Card') !== filters.paidWith) return false;
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
        if (e.debtRelated || e.walletNeutral) continue;
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

/**
 * Total Outflow: sum of ALL real money that left your pocket.
 * Includes Big Expenses (rent), normal expenses, and loans given.
 * Excludes loan settlements (money coming back) and wallet-neutral entries.
 */
export function totalOutflow(expenses: ExpenseRecord[]): number {
    return expenses
        .filter((e) => !e.deleted && !e.walletNeutral)
        .reduce((sum, e) => sum + Math.abs(e.amountInALL), 0);
}

/**
 * Spend Against Budget: what actually hit your `Remaining`.
 * Excludes Big Expenses (pre-budgeted) and loan settlements.
 */
export function spendAgainstBudget(expenses: ExpenseRecord[]): number {
    return expenses
        .filter((e) => !e.deleted && !e.walletNeutral && !e.isBigExpense && !e.debtRelated)
        .reduce((sum, e) => sum + (e.budgetAmountALL ?? e.amountInALL), 0);
}

/**
 * Cash Flow: Money IN minus Money OUT, EXCLUDING regular expenses.
 * Money in = loans received + repayments received + refunds.
 * Money out = loans given + repayments made.
 */
export function cashFlow(expenses: ExpenseRecord[]): { inALL: number; outALL: number; netALL: number } {
    let inALL = 0;
    let outALL = 0;

    for (const e of expenses) {
        if (e.deleted || e.walletNeutral) continue;
        const amount = Math.abs(e.amountInALL);

        if (e.debtRelated) {
            if (e.amount > 0) inALL += amount;
            else if (e.amount < 0) outALL += amount;
            continue;
        }

        if (e.isDebtOrigin) {
            if (e.amount < 0) inALL += amount;
            else outALL += amount;
        }
    }

    return { inALL, outALL, netALL: inALL - outALL };
}

export interface CategoryStat {
    category: Category;
    total: number;
    count: number;
    percent: number;
}

export function aggregateByCategory(expenses: ExpenseRecord[]): CategoryStat[] {
    const map = new Map<Category, { total: number; count: number }>();
    let grandTotal = 0;

    for (const e of expenses) {
        if (e.debtRelated || e.walletNeutral) continue;
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

export interface PaidWithStat {
    cash: number;
    card: number;
    cashPct: number;
    cardPct: number;
}

export function aggregatePaidWith(expenses: ExpenseRecord[]): PaidWithStat {
    let cash = 0;
    let card = 0;

    for (const e of expenses) {
        if (e.debtRelated || e.walletNeutral) continue;
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