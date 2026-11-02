// src/components/SplitupNetBalancesCard.tsx
import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ChevronDown, ChevronRight, Users, ExternalLink } from 'lucide-react';
import { cn } from '../utils/cn';
import { formatCurrency } from '../utils/currency';

const SPLITUP_URL =
  (import.meta as any).env?.VITE_SPLITUP_URL || 'https://splitup.app';

interface GroupSummary {
  _id: string;
  name: string;
  currency: string;
  myNetBalanceALL: number;
  memberCount: number;
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

export const SplitupNetBalancesCard: React.FC = () => {
  const groups: GroupSummary[] =
    useQuery((api as any).groups?.getMyGroups, {}) || [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const groupDetails: GroupDetails | null = useQuery(
    (api as any).groups?.getGroupDetails,
    expandedId ? { groupId: expandedId as any } : ('skip' as any)
  ) as GroupDetails | null;

  const memberBalances = useMemo(() => {
    if (!groupDetails) return new Map<string, number>();
    return computeMemberBalances(groupDetails);
  }, [groupDetails]);

  if (groups.length === 0) return null;

  const totalNet = groups.reduce((sum, g) => sum + (g.myNetBalanceALL ?? 0), 0);
  const tripCount = groups.length;
  const netLabel =
    totalNet > 0
      ? `you're owed ${formatCurrency(totalNet, 'ALL')}`
      : totalNet < 0
        ? `you owe ${formatCurrency(Math.abs(totalNet), 'ALL')}`
        : 'you are even';

  return (
    <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-slate-200 p-5 shadow-sm space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Shared Trips</h3>
            <p className="text-[11px] text-slate-500">
              Across {tripCount} active {tripCount === 1 ? 'group' : 'groups'} — {netLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {groups.map((g) => {
          const net = g.myNetBalanceALL ?? 0;
          const isOpen = expandedId === g._id;
          return (
            <div key={g._id} className="rounded-2xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : g._id)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {g.name}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <span
                  className={cn(
                    'text-xs font-mono font-bold shrink-0',
                    net > 0
                      ? 'text-emerald-600'
                      : net < 0
                        ? 'text-rose-600'
                        : 'text-slate-400'
                  )}
                >
                  {net === 0 ? '—' : formatCurrency(Math.abs(net), 'ALL')}
                </span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2 bg-slate-50/50">
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
                        href={`${SPLITUP_URL}/?groupId=${g._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline"
                      >
                        Open in Splitup <ExternalLink className="w-3 h-3" />
                      </a>
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