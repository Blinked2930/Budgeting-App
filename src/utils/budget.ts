import type { BudgetCycle, ExpenseRecord } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse a YYYY-MM-DD string as a local-time date (midnight). */
export function parseLocalDate(value: string): Date {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Format a Date as YYYY-MM-DD in local time (for <input type="date">). */
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

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
    return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

export interface BudgetStats {
    /** Stipend + any extra cash carried in. */
    cycleBudget: number;
    /** Spending against the cycle budget (excludes Travel). */
    spent: number;
    /** Spending in the Travel category (paid from the travel stash). */
    travelSpent: number;
    /** cycleBudget - spent. Negative when overspent. */
    remaining: number;
    percentSpent: number;
    totalDays: number;
    /** Days until the next payday (minimum 1 for the math). */
    daysLeft: number;
    dayNumber: number;
    isPaydayReached: boolean;
    /** Today's allowance, fixed at the start of the day. */
    dailyAllowance: number;
    spentToday: number;
    leftToday: number;
    /** Unspent allowance from earlier days of this cycle. */
    bufferPool: number;
    /** Stash balance at cycle start minus travel spending since. */
    travelStashBalance: number;
    /** Leftover that moves into the travel stash at payday if nothing more is spent. */
    projectedSurplus: number;
    /** Starting balance + stipend - every tracked expense in the cycle. */
    estimatedBankBalance: number;
}

export function computeBudgetStats(
    cycle: BudgetCycle,
    expenses: ExpenseRecord[],
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
    let spentBeforeToday = 0;
    let allTracked = 0;

    for (const e of expenses) {
        if (e.deleted) continue;
        const whenMs = new Date(e.timestamp).getTime();
        if (whenMs < startMs) continue;

        allTracked += e.amountInALL;

        if (e.category === 'Travel') {
            travelSpent += e.amountInALL;
            continue;
        }

        spent += e.amountInALL;
        if (whenMs >= todayMs) {
            spentToday += e.amountInALL;
        } else {
            spentBeforeToday += e.amountInALL;
        }
    }

    const cycleBudget = cycle.stipendAmountALL + cycle.bufferPoolALL;
    const remaining = cycleBudget - spent;
    const dailyAllowance = (remaining + spentToday) / daysLeft;
    const leftToday = dailyAllowance - spentToday;

    const baseDaily = cycleBudget / totalDays;
    const bufferPool = Math.max(0, baseDaily * daysElapsed - spentBeforeToday);

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
        estimatedBankBalance:
            cycle.startingRaiffeisenBalanceALL + cycle.stipendAmountALL - allTracked,
    };
}

/**
 * Converts a YYYY-MM-DD string into a full ISO timestamp set to noon UTC.
 * This prevents timezone shifts from accidentally moving the entry to the previous day.
 */
export function dateToNoonISO(dateString: string): string {
    return `${dateString}T12:00:00Z`;
}