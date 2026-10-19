// src/utils/budget.ts
import type { BudgetCycle, DebtRecord, ExpenseRecord, TransferRecord } from '../types';

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
    estimatedBankBalance: number;
    estimatedCashBalance: number;
    estimatedTotalBalance: number;
    receivablesALL: number;
    payablesALL: number;
    netOfDebtsALL: number;
    netWorthALL: number;
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
    debts: DebtRecord[] = [],
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
    let cardSpent = 0;
    let cashSpent = 0;

    const spentByDay = new Map<string, number>();

    for (const e of expenses) {
        if (e.deleted) continue;
        const when = new Date(e.timestamp);
        const whenMs = when.getTime();
        if (whenMs < startMs) continue;

        if (!e.walletNeutral) {
            if (e.paidWith === 'Cash') cashSpent += e.amountInALL;
            else cardSpent += e.amountInALL;
        }

        if (e.debtRelated) continue;

        const budgetImpact = e.budgetAmountALL ?? e.amountInALL;

        if (e.category === 'Travel') {
            travelSpent += budgetImpact;
            continue;
        }

        spent += budgetImpact;

        if (whenMs >= todayMs) {
            spentToday += budgetImpact;
        } else {
            spentBeforeToday += budgetImpact;
            const key = dayKey(when);
            spentByDay.set(key, (spentByDay.get(key) ?? 0) + budgetImpact);
        }
    }

    let bankToCash = 0;
    let cashToBank = 0;
    for (const t of transfers) {
        if (t.deleted) continue;
        const whenMs = new Date(t.timestamp).getTime();
        if (whenMs < startMs) continue;

        if (t.direction === 'BankToCash') bankToCash += t.amountALL;
        else cashToBank += t.amountALL;
    }

    const cycleBudget = cycle.stipendAmountALL + cycle.bufferPoolALL;
    const remaining = cycleBudget - spent;

    // Daily allowance: caps at base daily, shrinks if deficit, never grows.
    const baseDaily = cycleBudget / totalDays;
    const rawAllowance = (remaining + spentToday) / daysLeft;
    const dailyAllowance = Math.min(baseDaily, rawAllowance);
    const leftToday = dailyAllowance - spentToday;

    // Buffer pool: how much we *should* have spent by now vs what we actually spent.
    const bufferPool = Math.max(0, baseDaily * daysElapsed - spentBeforeToday);

    const startingCash = cycle.startingCashALL ?? 0;
    const estimatedBankBalance =
        cycle.startingRaiffeisenBalanceALL +
        cycle.stipendAmountALL -
        cardSpent -
        bankToCash +
        cashToBank;
    const estimatedCashBalance =
        startingCash - cashSpent - cashToBank + bankToCash;

    let receivablesALL = 0;
    let payablesALL = 0;
    for (const d of debts) {
        if (d.deleted || d.status !== 'open') continue;
        if (d.direction === 'OwedToMe') receivablesALL += d.remainingALL;
        else payablesALL += d.remainingALL;
    }
    const netOfDebtsALL = receivablesALL - payablesALL;

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
        receivablesALL,
        payablesALL,
        netOfDebtsALL,
        netWorthALL: estimatedBankBalance + estimatedCashBalance + netOfDebtsALL,
    };
}

export function dateToNoonISO(dateString: string): string {
    return `${dateString}T12:00:00Z`;
}