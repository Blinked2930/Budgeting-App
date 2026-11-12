// src/utils/splitupBridge.ts
import { type Category, DEFAULT_EXCHANGE_RATES, type ExchangeRates } from '../types';

export interface BridgeGroupMember {
  _id: string;
  name: string;
  userId?: string;
}

export interface BridgeGroupExpense {
  _id: string;
  groupId: string;
  groupName: string;
  title: string;
  category?: string;
  currency: string;
  amount: number;
  amountInALL: number;
  fxRateToALL?: number;
  paidByMemberId: string;
  splitType: 'equal' | 'exact' | 'shares';
  splits: Array<{ memberId: string; amountALL: number }>;
  timestamp: number;
}

export interface BridgeGroupSettlement {
  _id: string;
  groupId: string;
  groupName: string;
  fromMemberId: string;
  toMemberId: string;
  amount?: number;
  amountALL: number;
  fxRateToALL?: number;
  currency: string;
  paidWith?: 'Cash' | 'Card';
  timestamp: number;
}

export interface BridgeGroupDetails {
  group: { _id: string; name: string; currency: string };
  members: BridgeGroupMember[];
  expenses: Omit<BridgeGroupExpense, 'groupId' | 'groupName'>[];
  settlements: Omit<BridgeGroupSettlement, 'groupId' | 'groupName'>[];
}

export interface BridgeGroupSummary {
  _id: string;
  name: string;
  currency?: string;
  myNetBalanceALL: number;
  memberCount: number;
  isOwner?: boolean;
}

export interface BridgeMyShare {
  amountALL: number;
  category: Category;
  paidByMemberId: string;
  paidByMemberName: string;
  timestamp: number;
  groupId: string;
  groupName: string;
  title: string;
}

export interface BridgeCycleRollup {
  expensesYouPaid: BridgeGroupExpense[];
  yourSharesOfOthersExpenses: BridgeMyShare[];
  settlementsOut: BridgeGroupSettlement[];
  settlementsIn: BridgeGroupSettlement[];

  totalExpensesYouPaidALL: number;
  totalYourSharesALL: number;
  totalSettlementsOutALL: number;
  totalSettlementsInALL: number;

  categoryTotals: Partial<Record<Category, number>>;
  categoryCounts: Partial<Record<Category, number>>;
}

function normalizeExpenseAmounts(
  exp: Omit<BridgeGroupExpense, 'groupId' | 'groupName'>,
  rates: ExchangeRates
): { amountInALL: number; splits: Array<{ memberId: string; amountALL: number }> } {
  const cur = (exp.currency || 'ALL').trim().toUpperCase();
  if (cur === 'ALL') {
    return { amountInALL: exp.amountInALL, splits: exp.splits };
  }
  const rate = rates[cur];
  // Guard against pre-fix records where amountInALL was stored 1:1 with non-ALL amount
  if (rate && rate !== 1 && Math.abs(exp.amountInALL - exp.amount) < 0.001) {
    const fixedTotal = Math.round(exp.amount * rate * 100) / 100;
    const fixedSplits = exp.splits.map((s) => ({
      ...s,
      amountALL: Math.round(s.amountALL * rate * 100) / 100,
    }));
    return { amountInALL: fixedTotal, splits: fixedSplits };
  }
  return { amountInALL: exp.amountInALL, splits: exp.splits };
}

function normalizeSettlementAmountALL(
  set: Omit<BridgeGroupSettlement, 'groupId' | 'groupName'>,
  rates: ExchangeRates
): number {
  const cur = (set.currency || 'ALL').trim().toUpperCase();
  if (cur === 'ALL') return set.amountALL;
  const rate = rates[cur];
  if (rate && rate !== 1 && set.amount === undefined) {
    return Math.round(set.amountALL * rate * 100) / 100;
  }
  return set.amountALL;
}

export function mapSplitupCategory(raw?: string): Category {
  if (!raw) return 'Other';
  const s = raw.trim().toLowerCase();
  if (!s) return 'Other';
  if (s.includes('food') || s.includes('dining') || s.includes('restaurant') || s.includes('meal')) return 'Food';
  if (s.includes('utility') || s.includes('utilities') || s.includes('bill')) return 'Utilities';
  if (s.includes('transport') || s.includes('taxi') || s.includes('bus') || s.includes('train')) return 'Transport';
  if (s.includes('social') || s.includes('party') || s.includes('drinks')) return 'Social';
  if (s.includes('travel') || s.includes('trip') || s.includes('flight')) return 'Travel';
  if (s.includes('accommod') || s.includes('hotel') || s.includes('lodging')) return 'Accommodation';
  if (s.includes('entertain') || s.includes('movie') || s.includes('concert')) return 'Entertainment';
  return 'Other';
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function findSelfMember(
  members: BridgeGroupMember[],
  clerkUserId: string | null | undefined,
  displayNames: string[]
): BridgeGroupMember | null {
  if (clerkUserId) {
    const byId = members.find((m) => m.userId === clerkUserId);
    if (byId) return byId;
  }
  const candidateNames = displayNames
    .map((n) => normalizeName(n ?? ''))
    .filter((n) => n.length > 0);
  if (candidateNames.length === 0) return null;

  for (const m of members) {
    if (candidateNames.includes(normalizeName(m.name))) return m;
  }
  return null;
}

interface RollupInput {
  groupSummaries: BridgeGroupSummary[];
  groupDetailsById: Record<string, BridgeGroupDetails | null | undefined>;
  cycleStartMs: number;
  clerkUserId: string | null | undefined;
  displayNames: string[];
  rates?: ExchangeRates;
}

export function buildCycleRollup(input: RollupInput): BridgeCycleRollup {
  const rates = input.rates ?? DEFAULT_EXCHANGE_RATES;
  const result: BridgeCycleRollup = {
    expensesYouPaid: [],
    yourSharesOfOthersExpenses: [],
    settlementsOut: [],
    settlementsIn: [],
    totalExpensesYouPaidALL: 0,
    totalYourSharesALL: 0,
    totalSettlementsOutALL: 0,
    totalSettlementsInALL: 0,
    categoryTotals: {},
    categoryCounts: {},
  };

  for (const summary of input.groupSummaries) {
    const details = input.groupDetailsById[summary._id];
    if (!details) continue;

    const self = findSelfMember(details.members, input.clerkUserId, input.displayNames);
    if (!self) continue;

    const memberNameById = new Map<string, string>();
    for (const m of details.members) memberNameById.set(m._id, m.name);

    // ---- Expenses ----
    for (const exp of details.expenses) {
      if (exp.timestamp < input.cycleStartMs) continue;

      const normalized = normalizeExpenseAmounts(exp, rates);
      const youPaid = exp.paidByMemberId === self._id;

      if (youPaid) {
        const category = mapSplitupCategory(exp.category);
        const enriched: BridgeGroupExpense = {
          ...exp,
          amountInALL: normalized.amountInALL,
          splits: normalized.splits,
          groupId: summary._id,
          groupName: summary.name,
        };
        result.expensesYouPaid.push(enriched);
        result.totalExpensesYouPaidALL += normalized.amountInALL;
        result.categoryTotals[category] = (result.categoryTotals[category] ?? 0) + normalized.amountInALL;
        result.categoryCounts[category] = (result.categoryCounts[category] ?? 0) + 1;
      } else {
        const yourSplit = normalized.splits.find((s) => s.memberId === self._id);
        if (!yourSplit || yourSplit.amountALL <= 0) continue;

        const category = mapSplitupCategory(exp.category);
        const paidByName = memberNameById.get(exp.paidByMemberId) ?? 'Someone';
        result.yourSharesOfOthersExpenses.push({
          amountALL: yourSplit.amountALL,
          category,
          paidByMemberId: exp.paidByMemberId,
          paidByMemberName: paidByName,
          timestamp: exp.timestamp,
          groupId: summary._id,
          groupName: summary.name,
          title: exp.title,
        });
        result.totalYourSharesALL += yourSplit.amountALL;
        result.categoryTotals[category] = (result.categoryTotals[category] ?? 0) + yourSplit.amountALL;
        result.categoryCounts[category] = (result.categoryCounts[category] ?? 0) + 1;
      }
    }

    // ---- Settlements ----
    for (const set of details.settlements) {
      if (set.timestamp < input.cycleStartMs) continue;

      const normalizedAmountALL = normalizeSettlementAmountALL(set, rates);
      const enriched: BridgeGroupSettlement = {
        ...set,
        amountALL: normalizedAmountALL,
        groupId: summary._id,
        groupName: summary.name,
      };
      if (set.fromMemberId === self._id) {
        result.settlementsOut.push(enriched);
        result.totalSettlementsOutALL += normalizedAmountALL;
      } else if (set.toMemberId === self._id) {
        result.settlementsIn.push(enriched);
        result.totalSettlementsInALL += normalizedAmountALL;
      }
    }
  }

  return result;
}

export function walletDeltaFromRollup(rollup: BridgeCycleRollup): number {
  return (
    -rollup.totalExpensesYouPaidALL
    - rollup.totalSettlementsOutALL
    + rollup.totalSettlementsInALL
  );
}