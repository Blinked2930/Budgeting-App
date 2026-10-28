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
    bigExpenseSpent: number;
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

    let spent = 0;              // Regular expenses only (excludes Big Expenses, loan settlements)
    let bigExpenseSpent = 0;    // Track separately
    let travelSpent = 0;
    let spentToday = 0;
    let spentBeforeToday = 0;
    let cardSpent = 0;
    let cashSpent = 0;

    for (const e of expenses) {
        if (e.deleted) continue;
        const when = new Date(e.timestamp);
        const whenMs = when.getTime();
        if (whenMs < startMs) continue;

        // Wallet tracking (for estimated bank/cash balances)
        if (!e.walletNeutral) {
            if (e.paidWith === 'Cash') cashSpent += e.amountInALL;
            else cardSpent += e.amountInALL;
        }

        // Debt settlements don't count against budget
        if (e.debtRelated) continue;

        const budgetImpact = e.budgetAmountALL ?? e.amountInALL;

        // Travel is paid from the stash, not the daily budget
        if (e.category === 'Travel') {
            travelSpent += budgetImpact;
            continue;
        }

        // Big Expenses are tracked separately — they were pre-budgeted
        // via plannedBigExpensesALL, so we don't subtract them from `spent`.
        if (e.isBigExpense) {
            bigExpenseSpent += budgetImpact;
            continue;
        }

        // Regular budget spending
        spent += budgetImpact;

        if (whenMs >= todayMs) {
            spentToday += budgetImpact;
        } else {
            spentBeforeToday += budgetImpact;
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

    // Rent is already subtracted from cycleBudget via plannedBigExpensesALL.
    const planned = cycle.plannedBigExpensesALL ?? 0;
    const cycleBudget = cycle.stipendAmountALL + cycle.bufferPoolALL - planned;
    const remaining = cycleBudget - spent;

    const baseDaily = cycleBudget / totalDays;
    const rawAllowance = (remaining + spentToday) / daysLeft;
    const dailyAllowance = Math.min(baseDaily, rawAllowance);
    const leftToday = dailyAllowance - spentToday;

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

    // Progress bar = fraction of TOTAL stipend used (regular + rent), not cycle budget
    const baseTotal = cycle.stipendAmountALL + cycle.bufferPoolALL;
    const percentSpent = baseTotal > 0
        ? Math.min(100, ((spent + bigExpenseSpent) / baseTotal) * 100)
        : 0;

    return {
        cycleBudget,
        spent,
        bigExpenseSpent,
        travelSpent,
        remaining,
        percentSpent,
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