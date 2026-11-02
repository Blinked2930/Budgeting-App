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

// ---------------------------------------------------------------------------
// Shared classification. computeBudgetStats AND the Audit panel both use these,
// so the two can never disagree about where an entry belongs.
// ---------------------------------------------------------------------------

export type ExpenseBucket =
    | 'reconciliation'
    | 'debtSettlement'
    | 'debtOrigin'
    | 'forgiveness'
    | 'travel'
    | 'big'
    | 'noWalletSpending'
    | 'regular';

export function isReconciliationEntry(e: ExpenseRecord): boolean {
    return (e.itemName ?? '').trim().toLowerCase() === 'balance reconciliation';
}

/** Order matters. First match wins. */
export function classifyExpense(e: ExpenseRecord): ExpenseBucket {
    if (isReconciliationEntry(e)) return 'reconciliation';
    if (e.isDebtOrigin) return 'debtOrigin';
    if (e.debtRelated) return 'debtSettlement';
    if (e.walletNeutral && (e.itemName ?? '').trim().startsWith('Offset from ')) return 'debtSettlement';
    if (e.isForgiveness) return 'forgiveness';
    if (e.category === 'Travel') return 'travel';
    if (e.isBigExpense) return 'big';
    if (e.walletNeutral) return 'noWalletSpending';
    return 'regular';
}

/** How much of this entry counts against the budget. */
export function budgetImpactOf(e: ExpenseRecord): number {
    return e.budgetAmountALL ?? e.amountInALL;
}

/** Cycle start as local midnight. */
export function cycleStartMs(cycle: BudgetCycle): number {
    return parseLocalDate(cycle.startDate).getTime();
}

/**
 * Where does the travel stash physically live?
 */
export const TRAVEL_STASH_IS_INSIDE_WALLET = true;

/**
 * Minimal Splitup snapshot passed into computeBudgetStats so free-to-spend
 * can reflect "I'm owed money via shared groups" without needing the full
 * group data. Filled from getMyGroups; split by direction so receivables
 * and payables are visible.
 */
export interface SplitupSnapshot {
    /** Positive: total owed to you across all shared groups. */
    receivablesALL: number;
    /** Positive: total you owe across all shared groups. */
    payablesALL: number;
}

export const EMPTY_SPLITUP_SNAPSHOT: SplitupSnapshot = {
    receivablesALL: 0,
    payablesALL: 0,
};

/**
 * Build a SplitupSnapshot from getMyGroups output. Each group's
 * `myNetBalanceALL` is your net in that group: positive = you're owed,
 * negative = you owe.
 */
export function snapshotFromGroups(
    groups: Array<{ myNetBalanceALL?: number }> | undefined | null
): SplitupSnapshot {
    if (!groups || groups.length === 0) return EMPTY_SPLITUP_SNAPSHOT;
    let rec = 0;
    let pay = 0;
    for (const g of groups) {
        const net = g.myNetBalanceALL ?? 0;
        if (net > 0) rec += net;
        else if (net < 0) pay += -net;
    }
    return { receivablesALL: rec, payablesALL: pay };
}

export interface BudgetStats {
    cycleBudget: number;
    consumed: number;
    forgivenSpent: number;
    remaining: number;
    percentConsumed: number;

    plannedBig: number;
    bigExpenseSpent: number;
    unpaidBig: number;
    travelStashHeld: number;
    freeToSpend: number;

    travelSpent: number;
    travelStashBalance: number;

    totalDays: number;
    daysLeft: number;
    dayNumber: number;
    isPaydayReached: boolean;
    dailyAllowance: number;
    consumedToday: number;
    leftToday: number;
    bufferPool: number;

    estimatedBankBalance: number;
    estimatedCashBalance: number;
    walletTotal: number;

    // Local (Dexie) debt totals
    receivablesALL: number;
    payablesALL: number;

    // Splitup contribution (subset of the totals above)
    splitupReceivablesALL: number;
    splitupPayablesALL: number;

    netOfDebtsALL: number;
    netWorthALL: number;

    spent: number;
    spentToday: number;
    estimatedTotalBalance: number;
    projectedSurplus: number;
}

export function computeBudgetStats(
    cycle: BudgetCycle,
    expenses: ExpenseRecord[],
    transfers: TransferRecord[] = [],
    debts: DebtRecord[] = [],
    splitup: SplitupSnapshot = EMPTY_SPLITUP_SNAPSHOT,
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

    let cashDelta = 0;
    let cardDelta = 0;

    for (const e of expenses) {
        if (e.deleted) continue;
        const whenMs = new Date(e.timestamp).getTime();
        if (whenMs < startMs) continue;

        if (!e.walletNeutral) {
            const amt = e.amountInALL;
            if (e.paidWith === 'Cash') cashDelta -= amt;
            else cardDelta -= amt;
        }

        const bucket = classifyExpense(e);
        const budgetImpact = budgetImpactOf(e);

        switch (bucket) {
            case 'reconciliation':
            case 'debtSettlement':
            case 'debtOrigin':
                break;

            case 'travel':
                travelSpent += budgetImpact;
                break;

            case 'big':
                bigExpenseSpent += budgetImpact;
                break;

            case 'forgiveness':
                consumed += budgetImpact;
                forgivenSpent += budgetImpact;
                if (whenMs >= todayMs) consumedToday += budgetImpact;
                else consumedBeforeToday += budgetImpact;
                break;

            case 'regular':
            case 'noWalletSpending':
                consumed += budgetImpact;
                if (whenMs >= todayMs) consumedToday += budgetImpact;
                else consumedBeforeToday += budgetImpact;
                break;
        }
    }

    for (const t of transfers) {
        if (t.deleted) continue;
        const whenMs = new Date(t.timestamp).getTime();
        if (whenMs < startMs) continue;
        if (t.direction === 'BankToCash') {
            cashDelta += t.amountALL;
            cardDelta -= t.amountALL;
        } else {
            cashDelta -= t.amountALL;
            cardDelta += t.amountALL;
        }
    }

    const startingCash = cycle.startingCashALL ?? 0;
    const estimatedBankBalance = cycle.startingRaiffeisenBalanceALL + cycle.stipendAmountALL + cardDelta;
    const estimatedCashBalance = startingCash + cashDelta;
    const walletTotal = estimatedBankBalance + estimatedCashBalance;

    // Local debts (Dexie)
    let receivablesALL = 0;
    let payablesALL = 0;
    for (const d of debts) {
        if (d.deleted || d.status !== 'open') continue;
        if (d.direction === 'OwedToMe') receivablesALL += d.remainingALL;
        else payablesALL += d.remainingALL;
    }

    // Fold Splitup net into the same receivables/payables. This is the
    // "one ecosystem" bridge: owed money via a shared trip shows up as
    // money you have, owed to a trip member shows up as money you'll pay.
    const splitupReceivablesALL = splitup.receivablesALL;
    const splitupPayablesALL = splitup.payablesALL;
    const totalReceivablesALL = receivablesALL + splitupReceivablesALL;
    const totalPayablesALL = payablesALL + splitupPayablesALL;

    const netOfDebtsALL = totalReceivablesALL - totalPayablesALL;
    const travelStashBalance = cycle.travelStashALL - travelSpent;

    const plannedBig = cycle.plannedBigExpensesALL ?? 0;
    const unpaidBig = Math.max(0, plannedBig - bigExpenseSpent);
    const travelStashHeld = TRAVEL_STASH_IS_INSIDE_WALLET ? Math.max(0, travelStashBalance) : 0;
    const freeToSpend = walletTotal - unpaidBig - totalPayablesALL - travelStashHeld;

    const remaining = freeToSpend;
    const cycleBudget = freeToSpend + consumed;
    const percentConsumed = cycleBudget > 0
        ? Math.min(100, (consumed / cycleBudget) * 100)
        : 0;

    const baseDaily = cycleBudget / totalDays;
    const rawAllowance = (remaining + consumedToday) / daysLeft;
    const dailyAllowance = Math.min(baseDaily, rawAllowance);
    const leftToday = dailyAllowance - consumedToday;
    const bufferPool = Math.max(0, baseDaily * daysElapsed - consumedBeforeToday);

    return {
        cycleBudget,
        consumed,
        forgivenSpent,
        remaining,
        percentConsumed,
        plannedBig,
        bigExpenseSpent,
        unpaidBig,
        travelStashHeld,
        freeToSpend,
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
        receivablesALL: totalReceivablesALL,
        payablesALL: totalPayablesALL,
        splitupReceivablesALL,
        splitupPayablesALL,
        netOfDebtsALL,
        netWorthALL: walletTotal + (TRAVEL_STASH_IS_INSIDE_WALLET ? 0 : travelStashBalance) + netOfDebtsALL,
        spent: consumed,
        spentToday: consumedToday,
        estimatedTotalBalance: walletTotal,
        projectedSurplus: Math.max(0, remaining),
    };
}

export function dateToNoonISO(dateString: string): string {
    return `${dateString}T12:00:00Z`;
}