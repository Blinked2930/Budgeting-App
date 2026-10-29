// src/utils/insights.ts
import type { Category, ExpenseRecord, PaymentSource } from '../types';
import { classifyExpense } from './budget';

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

export function isReconciliation(e: ExpenseRecord): boolean {
    return (e.itemName ?? '').trim().toLowerCase() === 'balance reconciliation';
}

/**
 * Entries that are not spending: reconciliations, loans and repayments, debt offsets.
 * Uses the same classifier as the Budget tab so the two can never disagree.
 */
export function isNonSpending(e: ExpenseRecord): boolean {
    const bucket = classifyExpense(e);
    return bucket === 'reconciliation' || bucket === 'debtSettlement' || bucket === 'debtOrigin';
}

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
        if (isNonSpending(e)) continue;
        keys.add(monthKey(e.timestamp));
    }
    return Array.from(keys).sort().reverse();
}

export function filterExpenses(
    expenses: ExpenseRecord[],
    filters: InsightFilters
): ExpenseRecord[] {
    return expenses.filter((e) => {
        if (isNonSpending(e)) return false;
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
}

export function aggregate(expenses: ExpenseRecord[]): Aggregate {
    let total = 0;
    let count = 0;

    for (const e of expenses) {
        if (isNonSpending(e)) continue;
        total += e.budgetAmountALL ?? e.amountInALL;
        count += 1;
    }

    return {
        total,
        count,
        average: count > 0 ? total / count : 0,
    };
}

export function spendAgainstBudget(expenses: ExpenseRecord[]): number {
    return expenses
        .filter((e) => !e.deleted && !isNonSpending(e) && !e.isBigExpense)
        .reduce((sum, e) => sum + (e.budgetAmountALL ?? e.amountInALL), 0);
}

export function totalOutflow(expenses: ExpenseRecord[]): number {
    return expenses
        .filter((e) => {
            if (e.deleted) return false;
            if (isNonSpending(e)) return false;
            return e.amount > 0;
        })
        .reduce((sum, e) => sum + Math.abs(e.amountInALL), 0);
}

export function cashFlow(expenses: ExpenseRecord[]): { inALL: number; outALL: number; netALL: number } {
    let inALL = 0;
    let outALL = 0;

    for (const e of expenses) {
        if (e.deleted) continue;
        if (isReconciliation(e)) continue;
        if (e.walletNeutral) continue;

        const amount = Math.abs(e.amountInALL);

        if (e.debtRelated && e.amount < 0) { inALL += amount; continue; }
        if (e.debtRelated && e.amount > 0) { outALL += amount; continue; }

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
        if (isNonSpending(e)) continue;
        if (e.isBigExpense) continue;
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
        if (isNonSpending(e)) continue;
        if (e.isBigExpense) continue;
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