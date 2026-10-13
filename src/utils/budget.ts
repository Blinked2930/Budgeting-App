// src/utils/budget.ts
import type { BudgetCycle, ExpenseRecord, TransferRecord } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseLocalDate(value: string): Date {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function toDateInputValue(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function daysBetween(from: Date, to: Date): number {
    return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

export interface BudgetStats {
    cycleBudget: number;
    spent: number;
    travelSpent: number;
    remaining: number;
    percentSpent: number;
    totalDays: number;
    daysLeft: number;
    dayNumber: number;
    isPaydayReached: boolean;
    dailyAllowance: number;
    spentToday: number;
    leftToday: number;
    bufferPool: number;
    travelStashBalance: number;
    projectedSurplus: number;
    /** Estimated balance in Raiffeisen (starting + stipend − card spend − transfers out + transfers in). */
    estimatedBankBalance: number;
    /** Estimated balance in cash (starting cash − cash spend − transfers out + transfers in). */
    estimatedCashBalance: number;
    /** Total tracked money across both sources. */
    estimatedTotalBalance: number;
}

function dayKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function computeBudgetStats(
    cycle: BudgetCycle,
    expenses: ExpenseRecord[],
    transfers: TransferRecord[] = [],
    now: Date = new Date()
): BudgetStats {
    const start = parseLocalDate(cycle.startDate);
    const end = parseLocalDate(cycle.targetEndDate);
    const today = startOfDay(now);
    const startMs = start.getTime();
    const todayMs = today.getTime();

    const totalDays = Math.max(1, daysBetween(start, end));
    const rawDaysLeft = daysBetween(today, end);
    const isPaydayReached = rawDaysLeft <= 0;
    const daysLeft = Math.max(1, rawDaysLeft);
    const daysElapsed = Math.min(totalDays, Math.max(0, daysBetween(start, today)));
    const dayNumber = Math.min(totalDays, daysElapsed + 1);

    let spent = 0;
    let travelSpent = 0;
    let spentToday = 0;
    let cardSpent = 0;
    let cashSpent = 0;

    const spentByDay = new Map<string, number>();

    for (const e of expenses) {
        if (e.deleted) continue;
        const when = new Date(e.timestamp);
        const whenMs = when.getTime();
        if (whenMs < startMs) continue;

        if (e.category === 'Travel') {
            travelSpent += e.amountInALL;
            continue;
        }

        spent += e.amountInALL;

        // Legacy rows without paidWith are treated as Card.
        if (e.paidWith === 'Cash') {
            cashSpent += e.amountInALL;
        } else {
            cardSpent += e.amountInALL;
        }

        if (whenMs >= todayMs) {
            spentToday += e.amountInALL;
        } else {
            const key = dayKey(when);
            spentByDay.set(key, (spentByDay.get(key) ?? 0) + e.amountInALL);
        }
    }

    let bankToCash = 0;
    let cashToBank = 0;
    for (const t of transfers) {
        if (t.deleted) continue;
        const whenMs = new Date(t.timestamp).getTime();
        if (whenMs < startMs) continue;

        if (t.direction === 'BankToCash') {
            bankToCash += t.amountALL;
        } else {
            cashToBank += t.amountALL;
        }
    }

    const cycleBudget = cycle.stipendAmountALL + cycle.bufferPoolALL;
    const remaining = cycleBudget - spent;
    const dailyAllowance = (remaining + spentToday) / daysLeft;
    const leftToday = dailyAllowance - spentToday;

    const baseDaily = cycleBudget / totalDays;
    let bufferPool = 0;
    for (const daySpend of spentByDay.values()) {
        const diff = baseDaily - daySpend;
        if (diff > 0) bufferPool += diff;
    }

    const startingCash = cycle.startingCashALL ?? 0;
    const estimatedBankBalance =
        cycle.startingRaiffeisenBalanceALL +
        cycle.stipendAmountALL -
        cardSpent -
        bankToCash +
        cashToBank;
    const estimatedCashBalance =
        startingCash - cashSpent - cashToBank + bankToCash;

    return {
        cycleBudget,
        spent,
        travelSpent,
        remaining,
        percentSpent: cycleBudget > 0 ? Math.min(100, (spent / cycleBudget) * 100) : 0,
        totalDays,
        daysLeft: rawDaysLeft,
        dayNumber,
        isPaydayReached,
        dailyAllowance,
        spentToday,
        leftToday,
        bufferPool,
        travelStashBalance: cycle.travelStashALL - travelSpent,
        projectedSurplus: Math.max(0, remaining),
        estimatedBankBalance,
        estimatedCashBalance,
        estimatedTotalBalance: estimatedBankBalance + estimatedCashBalance,
    };
}

export function dateToNoonISO(dateString: string): string {
    return `${dateString}T12:00:00Z`;
}