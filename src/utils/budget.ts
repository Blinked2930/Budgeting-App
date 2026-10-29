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
    | 'reconciliation' // "Balance Reconciliation" entries: wallet only, never spending
    | 'debtSettlement' // debtRelated: wallet only, never spending
    | 'debtOrigin' // initial lend/borrow wallet movement: wallet only
    | 'forgiveness' // written-off debt: counts as spending, no wallet movement
    | 'walletNeutral' // bookkeeping only: no wallet movement, no spending
    | 'travel' // paid from the travel stash
    | 'big' // pre-budgeted big expense (rent etc.)
    | 'regular'; // normal consumption (negative amounts are refunds)

export function isReconciliationEntry(e: ExpenseRecord): boolean {
    return (e.itemName ?? '').trim().toLowerCase() === 'balance reconciliation';
}

/** Order matters. First match wins. */
export function classifyExpense(e: ExpenseRecord): ExpenseBucket {
    if (isReconciliationEntry(e)) return 'reconciliation';
    if (e.debtRelated) return 'debtSettlement';
    if (e.isDebtOrigin) return 'debtOrigin';
    if (e.isForgiveness) return 'forgiveness';
    if (e.walletNeutral) return 'walletNeutral';
    if (e.category === 'Travel') return 'travel';
    if (e.isBigExpense) return 'big';
    return 'regular';
}

/** How much of this entry counts against the budget. */
export function budgetImpactOf(e: ExpenseRecord): number {
    return e.budgetAmountALL ?? e.amountInALL;
}

/** Cycle start as local midnight (same convention computeBudgetStats uses). */
export function cycleStartMs(cycle: BudgetCycle): number {
    return parseLocalDate(cycle.startDate).getTime();
}

/**
 * Where does the travel stash physically live?
 * The stash is an earmark on money already sitting in your bank (travel spending
 * is paid from the bank, and "Next cycle" carries the bank balance forward as-is).
 * true  -> stash is part of walletTotal: it is held back from "free to spend"
 *          and is NOT added again to net worth.
 * false -> stash is separate money: not held back, added on top of net worth.
 */
export const TRAVEL_STASH_IS_INSIDE_WALLET = true;

export interface BudgetStats {
    cycleBudget: number;
    consumed: number;
    forgivenSpent: number;
    remaining: number;
    percentConsumed: number;

    plannedBig: number;
    bigExpenseSpent: number;
    /** Planned big expenses not yet paid (never negative). */
    unpaidBig: number;
    /** Travel stash held back from free money (0 if the stash is separate). */
    travelStashHeld: number;
    /** walletTotal - unpaidBig - payables - travelStashHeld. Equals `remaining`. */
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

    receivablesALL: number;
    payablesALL: number;
    netOfDebtsALL: number;
    netWorthALL: number;

    spent: number; // alias for consumed
    spentToday: number; // alias for consumedToday
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

    let cashDelta = 0;
    let cardDelta = 0;

    for (const e of expenses) {
        if (e.deleted) continue;
        const whenMs = new Date(e.timestamp).getTime();
        if (whenMs < startMs) continue;

        // Wallet movement: wallet-neutral entries do not move money.
        // Signed amount: positive = outflow, negative = inflow.
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
            case 'walletNeutral':
                // Not consumption.
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
                consumed += budgetImpact;
                if (whenMs >= todayMs) consumedToday += budgetImpact;
                else consumedBeforeToday += budgetImpact;
                break;
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
            cashDelta += t.amountALL;
            cardDelta -= t.amountALL;
        } else {
            cashToBank += t.amountALL;
            cashDelta -= t.amountALL;
            cardDelta += t.amountALL;
        }
    }
    void bankToCash;
    void cashToBank;

    // ---- Wallet side (what you actually have) ----
    const startingCash = cycle.startingCashALL ?? 0;
    const estimatedBankBalance = cycle.startingRaiffeisenBalanceALL + cycle.stipendAmountALL + cardDelta;
    const estimatedCashBalance = startingCash + cashDelta;
    const walletTotal = estimatedBankBalance + estimatedCashBalance;

    let receivablesALL = 0;
    let payablesALL = 0;
    for (const d of debts) {
        if (d.deleted || d.status !== 'open') continue;
        if (d.direction === 'OwedToMe') receivablesALL += d.remainingALL;
        else payablesALL += d.remainingALL;
    }
    const netOfDebtsALL = receivablesALL - payablesALL;
    const travelStashBalance = cycle.travelStashALL - travelSpent;

    // ---- Free to spend: anchored to the wallet, so every real money movement
    // (reconciliations, loans, settlements, transfers) is reflected automatically.
    // The wallet is already net of everything spent, so consumption is NOT
    // subtracted again here. Receivables are not spendable, so they are ignored.
    const plannedBig = cycle.plannedBigExpensesALL ?? 0;
    const unpaidBig = Math.max(0, plannedBig - bigExpenseSpent);
    const travelStashHeld = TRAVEL_STASH_IS_INSIDE_WALLET ? Math.max(0, travelStashBalance) : 0;
    const freeToSpend = walletTotal - unpaidBig - payablesALL - travelStashHeld;

    // "Cycle budget" = everything that was spendable this cycle = what is left + what is spent.
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
        receivablesALL,
        payablesALL,
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