// src/utils/splitupBridge.ts
import type { Category } from '../types';

/**
 * Splitup -> LekFlow bridge.
 *
 * Reads the outputs of the Convex group queries and produces aggregates
 * keyed to the *current user*, ready to fold into Audit / Insights.
 *
 * Pure. No hooks, no Convex. Just shape transformation + sum.
 *
 * Sign conventions (all in ALL, negative = money OUT of your wallet):
 *   - Group expense you paid:        -amountInALL
 *   - Group expense someone fronted, your split share:  no wallet movement
 *   - Settlement you paid:           -amountALL
 *   - Settlement you received:       +amountALL
 */

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
  amountALL: number;
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
  myNetBalanceALL: number;
  memberCount: number;
  isOwner?: boolean;
}

export interface BridgeMyShare {
  /** Raw amount (positive) that represents YOUR share of an expense someone else paid. */
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
  /** Group expenses YOU paid, in-window. */
  expensesYouPaid: BridgeGroupExpense[];
  /** Your share of group expenses someone else paid, in-window. */
  yourSharesOfOthersExpenses: BridgeMyShare[];
  /** Settlements YOU paid (money out). */
  settlementsOut: BridgeGroupSettlement[];
  /** Settlements YOU received (money in). */
  settlementsIn: BridgeGroupSettlement[];

  /** Sums, all in ALL. Positive numbers = money OUT unless noted. */
  totalExpensesYouPaidALL: number;
  totalYourSharesALL: number;
  totalSettlementsOutALL: number;
  totalSettlementsInALL: number;

  /** Per-category totals for the "Where your money went" merge. */
  categoryTotals: Partial<Record<Category, number>>;
  /** Number of Splitup contributions per category, for the "×N" counter. */
  categoryCounts: Partial<Record<Category, number>>;
}

/**
 * Fuzzy category mapping from Splitup's free-form strings into LekFlow's
 * Category union. Case-insensitive substring match, first hit wins.
 */
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

/**
 * Find the member row that represents the current user in this group.
 *
 * Priority:
 *   1. Exact `userId === clerkUserId` match.
 *   2. Case-insensitive name match against any of the caller-provided
 *      display names (typically Clerk `fullName`, `username`, and any
 *      nickname the user has set in LekFlow).
 *   3. null -> attribution skipped, entry is not folded into the user's
 *      personal rollup (safer than guessing).
 */
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
}

/**
 * Build the per-cycle Splitup rollup for the current user, from data the
 * caller already has. Pure. Never throws; bad groups are skipped.
 */
export function buildCycleRollup(input: RollupInput): BridgeCycleRollup {
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

      const youPaid = exp.paidByMemberId === self._id;
      if (youPaid) {
        const category = mapSplitupCategory(exp.category);
        const enriched: BridgeGroupExpense = {
          ...exp,
          groupId: summary._id,
          groupName: summary.name,
        };
        result.expensesYouPaid.push(enriched);
        result.totalExpensesYouPaidALL += exp.amountInALL;
        result.categoryTotals[category] = (result.categoryTotals[category] ?? 0) + exp.amountInALL;
        result.categoryCounts[category] = (result.categoryCounts[category] ?? 0) + 1;
      } else {
        // Your share of someone else's expense.
        const yourSplit = exp.splits.find((s) => s.memberId === self._id);
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

      const enriched: BridgeGroupSettlement = {
        ...set,
        groupId: summary._id,
        groupName: summary.name,
      };
      if (set.fromMemberId === self._id) {
        result.settlementsOut.push(enriched);
        result.totalSettlementsOutALL += set.amountALL;
      } else if (set.toMemberId === self._id) {
        result.settlementsIn.push(enriched);
        result.totalSettlementsInALL += set.amountALL;
      }
    }
  }

  return result;
}

/**
 * Mirror the wallet-identity extension used by the Audit panel: Splitup
 * expenses you paid move money OUT of the bank, settlements move money
 * OUT (if you paid) or IN (if you received). Your shares of others'
 * expenses are excluded — those are paid by the *other* person, so they
 * never touched your wallet. The local debt engine already reflects the
 * follow-on obligation when you eventually settle.
 */
export function walletDeltaFromRollup(rollup: BridgeCycleRollup): number {
  // negative = money left your wallet
  return (
    -rollup.totalExpensesYouPaidALL
    - rollup.totalSettlementsOutALL
    + rollup.totalSettlementsInALL
  );
}