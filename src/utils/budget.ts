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
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

export function daysBetween(start: Date, end: Date): number {
    const startMs = startOfDay(start).getTime();
    const endMs = startOfDay(end).getTime();
    return Math.round((endMs - startMs) / MS_PER_DAY);
}

export interface BudgetStats {
    // ---- BUDGET VIEW ----
    cycleBudget: number;
    consumed: number;           // regular consumption + forgiven gifts
    forgivenSpent: number;      // portion of `consumed` from write-offs (for display)
    remaining: number;
    percentConsumed: number;

    // ---- BIG EXPENSES ----
    plannedBig: number;
    bigExpenseSpent: number;

    // ---- TRAVEL ----
    travelSpent: number;
    travelStashBalance: number;

    // ---- DAILY MATH ----
    totalDays: number;
    daysLeft: number;
    dayNumber: number;
    isPaydayReached: boolean;
    dailyAllowance: number;
    consumedToday: number;
    leftToday: number;
    bufferPool: number;

    // ---- WALLET VIEW ----
    estimatedBankBalance: number;
    estimatedCashBalance: number;
    walletTotal: number;

    // ---- DEBTS ----
    receivablesALL: number;
    payablesALL: number;
    netOfDebtsALL: number;
    netWorthALL: number;

    // ---- COMPAT ALIASES ----
    spent: number;              // = consumed
    spentToday: number;         // = consumedToday
    estimatedTotalBalance: number;
    projectedSurplus: number;
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

    let consumed = 0;
    let forgivenSpent = 0;
    let bigExpenseSpent = 0;
    let travelSpent = 0;
    let consumedToday = 0;
    let consumedBeforeToday = 0;

    // Wallet movement per pocket (for reconciliation)
    let cashDelta = 0;   // money in - money out for CASH
    let cardDelta = 0;   // money in - money out for CARD

    for (const e of expenses) {
        if (e.deleted) continue;
        const whenMs = new Date(e.timestamp).getTime();
        if (whenMs < startMs) continue;

        // ---- WALLET MOVEMENT ----
        // Only count entries that actually touched a wallet.
        // walletNeutral entries do not move money. Signed amount:
        // positive = outflow, negative = inflow.
        if (!e.walletNeutral) {
            const amt = e.amountInALL;
            if (e.paidWith === 'Cash') cashDelta -= amt;
            else cardDelta -= amt;
        }

        // ---- EXPENSE BUCKETS ----
        // Loans and offsets are not consumption.
        const isLoan = e.debtRelated || e.isDebtOrigin;
        if (isLoan) continue;

        // Travel is paid from stash, not daily budget.
        const budgetImpact = e.budgetAmountALL ?? e.amountInALL;
        if (e.category === 'Travel') {
            travelSpent += budgetImpact;
            continue;
        }

        // Big Expenses are pre-budgeted separately.
        if (e.isBigExpense) {
            bigExpenseSpent += budgetImpact;
            continue;
        }

        // Forgiveness = money gone without wallet movement. Counts as expense.
        if (e.isForgiveness) {
            consumed += budgetImpact;
            forgivenSpent += budgetImpact;
            if (whenMs >= todayMs) consumedToday += budgetImpact;
            else consumedBeforeToday += budgetImpact;
            continue;
        }

        // Regular consumption (including genuine gifts you paid for).
        consumed += budgetImpact;
        if (whenMs >= todayMs) consumedToday += budgetImpact;
        else consumedBeforeToday += budgetImpact;
    }

    let bankToCash = 0;
    let cashToBank = 0;
    for (const t of transfers) {
        if (t.deleted) continue;
        const whenMs = new Date(t.timestamp).getTime();
        if (whenMs < startMs) continue;
        if (t.direction === 'BankToCash') {
            bankToCash += t.amountALL;
            cashDelta += t.amountALL;
            cardDelta -= t.amountALL;
        } else {
            cashToBank += t.amountALL;
            cashDelta -= t.amountALL;
            cardDelta += t.amountALL;
        }
    }

    // ---- BUDGET VIEW ----
    const plannedBig = cycle.plannedBigExpensesALL ?? 0;
    const cycleBudget = cycle.stipendAmountALL + cycle.bufferPoolALL - plannedBig;
    const remaining = cycleBudget - consumed;
    const percentConsumed = cycleBudget > 0
        ? Math.min(100, (consumed / cycleBudget) * 100)
        : 0;

    // ---- DAILY MATH ----
    const baseDaily = cycleBudget / totalDays;
    const rawAllowance = (remaining + consumedToday) / daysLeft;
    const dailyAllowance = Math.min(baseDaily, rawAllowance);
    const leftToday = dailyAllowance - consumedToday;
    const bufferPool = Math.max(0, baseDaily * daysElapsed - consumedBeforeToday);

    // ---- WALLET VIEW ----
    const startingCash = cycle.startingCashALL ?? 0;
    const estimatedBankBalance = cycle.startingRaiffeisenBalanceALL + cycle.stipendAmountALL + cardDelta;
    const estimatedCashBalance = startingCash + cashDelta;
    const walletTotal = estimatedBankBalance + estimatedCashBalance;

    // ---- DEBTS ----
    let receivablesALL = 0;
    let payablesALL = 0;
    for (const d of debts) {
        if (d.deleted || d.status !== 'open') continue;
        if (d.direction === 'OwedToMe') receivablesALL += d.remainingALL;
        else payablesALL += d.remainingALL;
    }
    const netOfDebtsALL = receivablesALL - payablesALL;
    const travelStashBalance = cycle.travelStashALL - travelSpent;

    return {
        cycleBudget,
        consumed,
        forgivenSpent,
        remaining,
        percentConsumed,

        plannedBig,
        bigExpenseSpent,

        travelSpent,
        travelStashBalance,

        totalDays,
        daysLeft: rawDaysLeft,
        dayNumber,
        isPaydayReached,
        dailyAllowance,
        consumedToday,
        leftToday,
        bufferPool,

        estimatedBankBalance,
        estimatedCashBalance,
        walletTotal,

        receivablesALL,
        payablesALL,
        netOfDebtsALL,
        netWorthALL: walletTotal + travelStashBalance + netOfDebtsALL,

        spent: consumed,
        spentToday: consumedToday,
        estimatedTotalBalance: walletTotal,
        projectedSurplus: Math.max(0, remaining),
    };
}

export function dateToNoonISO(dateString: string): string {
    return `${dateString}T12:00:00Z`;
}