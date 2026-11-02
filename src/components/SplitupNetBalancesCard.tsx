// src/components/SplitupNetBalancesCard.tsx
import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  ChevronDown,
  ChevronRight,
  Users,
  ExternalLink,
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { formatCurrency } from '../utils/currency';

const SPLITUP_URL =
  (import.meta as any).env?.VITE_SPLITUP_URL || 'https://splitup.app';

interface LocalDebt {
  id: string;
  counterparty: string;
  counterpartyKey: string;
  direction: 'iOwe' | 'OwedToMe';
  remainingALL: number;
  status: 'open' | 'resolved';
  note?: string;
}

interface GroupSummary {
  _id: string;
  name: string;
  currency: string;
  myNetBalanceALL: number;
  memberCount: number;
  isOwner?: boolean;
}

interface GroupMember {
  _id: string;
  name: string;
}

interface GroupExpense {
  _id: string;
  paidByMemberId: string;
  amountInALL: number;
  splits: Array<{ memberId: string; amountALL: number }>;
}

interface GroupSettlement {
  _id: string;
  fromMemberId: string;
  toMemberId: string;
  amountALL: number;
}

interface GroupDetails {
  group: { _id: string; name: string; currency: string };
  members: GroupMember[];
  expenses: GroupExpense[];
  settlements: GroupSettlement[];
}

/**
 * Compute per-member net balances from group details. Mirrors the math in
 * convex/groups.ts getMyGroups so the numbers here always agree with what
 * Splitup itself shows.
 *
 * net(m) = sum(expenses where m paid) - sum(splits owned by m)
 *        + sum(settlements where m paid the other) - sum(settlements where m received)
 */
function computeMemberBalances(details: GroupDetails): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of details.members) map.set(m._id, 0);

  for (const exp of details.expenses) {
    const current = map.get(exp.paidByMemberId) ?? 0;
    map.set(exp.paidByMemberId, current + exp.amountInALL);
    for (const split of exp.splits) {
      const m = map.get(split.memberId) ?? 0;
      map.set(split.memberId, m - split.amountALL);
    }
  }
  for (const set of details.settlements) {
    const from = map.get(set.fromMemberId) ?? 0;
    map.set(set.fromMemberId, from + set.amountALL);
    const to = map.get(set.toMemberId) ?? 0;
    map.set(set.toMemberId, to - set.amountALL);
  }
  return map;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

interface PersonRow {
  key: string;
  displayName: string;
  localNet: number;           // + means they owe you, - means you owe
  splitupNet: number;         // + means they owe you, - means you owe
  localDebtCount: number;
  groupRefs: Array<{
    groupId: string;
    groupName: string;
    netInGroup: number;       // from YOUR perspective, same sign convention
  }>;
}

interface DebtsAndSharedCardProps {
  localDebts: LocalDebt[];
}

export const DebtsAndSharedCard: React.FC<DebtsAndSharedCardProps> = ({ localDebts }) => {
  const groups: GroupSummary[] =
    useQuery((api as any).groups?.getMyGroups, {}) || [];
  const [expandedPersonKey, setExpandedPersonKey] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Fetch details only for the group whose sub-row is open.
  const groupDetails: GroupDetails | null = useQuery(
    (api as any).groups?.getGroupDetails,
    expandedGroupId ? { groupId: expandedGroupId as any } : ('skip' as any)
  ) as GroupDetails | null;

  const memberBalances = useMemo(() => {
    if (!groupDetails) return new Map<string, number>();
    return computeMemberBalances(groupDetails);
  }, [groupDetails]);

  /**
   * Build one merged list keyed by normalised name. For each person we
   * combine:
   *  - their local debt net (from LekFlow's Dexie)
   *  - their Splitup share inside any group whose members list contains
   *    their name
   *
   * We can't know Splitup per-member balances without fetching details for
   * every group, so we can only combine by *group-level* net here. That's
   * the design we agreed on: front-face simplified, real per-member numbers
   * appear when expanding the group.
   */
  const people = useMemo<PersonRow[]>(() => {
    const map = new Map<string, PersonRow>();

    const ensure = (rawName: string): PersonRow => {
      const key = normalizeName(rawName);
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          displayName: rawName.trim(),
          localNet: 0,
          splitupNet: 0,
          localDebtCount: 0,
          groupRefs: [],
        };
        map.set(key, row);
      } else if (rawName.trim().length < row.displayName.length) {
        // Prefer the shortest casing variant as the display name.
        row.displayName = rawName.trim();
      }
      return row;
    };

    for (const d of localDebts) {
      if (d.status !== 'open') continue;
      const row = ensure(d.counterparty);
      const signed = d.direction === 'OwedToMe' ? d.remainingALL : -d.remainingALL;
      row.localNet += signed;
      row.localDebtCount += 1;
    }

    // Group-level Splitup share only. Attribution to individual names inside
    // a group is deferred to the expand panel — we don't have per-member
    // balances without a details query per group, and doing N queries here
    // is exactly what we're avoiding.
    for (const g of groups) {
      // Use a synthetic person key so group rows live in the list too.
      // We tag them so the UI knows to render them as groups, not people.
      const row = ensure(`__group__:${g._id}`);
      row.displayName = g.name;
      row.localNet = 0;
      row.localDebtCount = 0;
      row.splitupNet = g.myNetBalanceALL ?? 0;
      row.groupRefs = [
        {
          groupId: g._id,
          groupName: g.name,
          netInGroup: g.myNetBalanceALL ?? 0,
        },
      ];
    }

    return Array.from(map.values()).sort((a, b) => {
      const aAbs = Math.abs(a.localNet + a.splitupNet);
      const bAbs = Math.abs(b.localNet + b.splitupNet);
      if (bAbs !== aAbs) return bAbs - aAbs;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [localDebts, groups]);

  const hasAny = people.length > 0;
  if (!hasAny) return null;

  const combinedNet = people.reduce(
    (sum, p) => sum + p.localNet + p.splitupNet,
    0
  );

  const groupCount = groups.length;
  const personCount = people.filter((p) => !p.key.startsWith('__group__:')).length;

  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3 font-sans">
      {/* Front face — deliberately minimal. Only the combined net + counts. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <HandCoins className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Debts & Shared</h3>
            <p className="text-[11px] text-slate-500">
              {personCount > 0
                ? `${personCount} ${personCount === 1 ? 'person' : 'people'}`
                : 'No personal debts'}
              {groupCount > 0 && ` · ${groupCount} ${groupCount === 1 ? 'group' : 'groups'}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className={cn(
              'text-sm font-mono font-bold',
              combinedNet > 0
                ? 'text-emerald-600'
                : combinedNet < 0
                  ? 'text-rose-600'
                  : 'text-slate-400'
            )}
          >
            {combinedNet === 0
              ? 'Settled'
              : `${combinedNet > 0 ? '+' : '−'}${formatCurrency(Math.abs(combinedNet), 'ALL')}`}
          </p>
          <p className="text-[10px] text-slate-400">
            {combinedNet > 0 ? 'net owed to you' : combinedNet < 0 ? 'net you owe' : 'all even'}
          </p>
        </div>
      </div>

      {/* Rows — one per person or per group. Expanded shows the breakdown. */}
      <div className="space-y-1.5">
        {people.map((p) => {
          const isGroup = p.key.startsWith('__group__:');
          const combined = p.localNet + p.splitupNet;
          const isExpanded = isGroup
            ? expandedGroupId === p.groupRefs[0]?.groupId
            : expandedPersonKey === p.key;

          const handleToggle = () => {
            if (isGroup) {
              const gid = p.groupRefs[0]?.groupId;
              if (!gid) return;
              setExpandedGroupId(expandedGroupId === gid ? null : gid);
            } else {
              setExpandedPersonKey(expandedPersonKey === p.key ? null : p.key);
            }
          };

          return (
            <div
              key={p.key}
              className="rounded-2xl border border-slate-200 overflow-hidden"
            >
              <button
                type="button"
                onClick={handleToggle}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  {isGroup ? (
                    <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-slate-700">
                        {p.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {p.displayName}
                  </span>
                  {!isGroup && p.localDebtCount > 0 && (
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {p.localDebtCount} {p.localDebtCount === 1 ? 'debt' : 'debts'}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs font-mono font-bold shrink-0',
                    combined > 0
                      ? 'text-emerald-600'
                      : combined < 0
                        ? 'text-rose-600'
                        : 'text-slate-400'
                  )}
                >
                  {combined === 0
                    ? '—'
                    : formatCurrency(Math.abs(combined), 'ALL')}
                </span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2 bg-slate-50/50">
                  {isGroup ? (
                    <>
                      {!groupDetails ? (
                        <p className="text-[11px] text-slate-400">Loading details…</p>
                      ) : (
                        <>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                              Member balances
                            </p>
                            <div className="space-y-0.5">
                              {groupDetails.members.map((m) => {
                                const mb = memberBalances.get(m._id) ?? 0;
                                return (
                                  <div
                                    key={m._id}
                                    className="flex justify-between text-[11px] gap-2"
                                  >
                                    <span className="text-slate-600 truncate">
                                      {m.name}
                                    </span>
                                    <span
                                      className={cn(
                                        'font-mono shrink-0',
                                        mb > 0
                                          ? 'text-emerald-600'
                                          : mb < 0
                                            ? 'text-rose-600'
                                            : 'text-slate-400'
                                      )}
                                    >
                                      {mb === 0
                                        ? 'settled'
                                        : formatCurrency(Math.abs(mb), 'ALL')}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <a
                            href={`${SPLITUP_URL}/?groupId=${p.groupRefs[0]?.groupId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline"
                          >
                            Open in Splitup <ExternalLink className="w-3 h-3" />
                          </a>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {p.localDebtCount > 0 && (
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                            Personal
                          </p>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-600">
                              {p.localNet > 0
                                ? 'owes you'
                                : p.localNet < 0
                                  ? 'you owe'
                                  : 'settled'}
                            </span>
                            <span
                              className={cn(
                                'font-mono',
                                p.localNet > 0
                                  ? 'text-emerald-600'
                                  : p.localNet < 0
                                    ? 'text-rose-600'
                                    : 'text-slate-400'
                              )}
                            >
                              {p.localNet === 0
                                ? '—'
                                : formatCurrency(Math.abs(p.localNet), 'ALL')}
                            </span>
                          </div>
                        </div>
                      )}
                      {p.groupRefs.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                            Shared groups
                          </p>
                          {p.groupRefs.map((g) => (
                            <div
                              key={g.groupId}
                              className="flex justify-between text-[11px] gap-2"
                            >
                              <span className="text-slate-600 truncate flex items-center gap-1">
                                {g.netInGroup >= 0 ? (
                                  <ArrowUpRight className="w-3 h-3 text-emerald-500 shrink-0" />
                                ) : (
                                  <ArrowDownLeft className="w-3 h-3 text-rose-500 shrink-0" />
                                )}
                                {g.groupName}
                              </span>
                              <span
                                className={cn(
                                  'font-mono shrink-0',
                                  g.netInGroup > 0
                                    ? 'text-emerald-600'
                                    : g.netInGroup < 0
                                      ? 'text-rose-600'
                                      : 'text-slate-400'
                                )}
                              >
                                {g.netInGroup === 0
                                  ? '—'
                                  : formatCurrency(Math.abs(g.netInGroup), 'ALL')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};