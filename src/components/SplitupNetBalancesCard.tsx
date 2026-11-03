// src/components/SplitupNetBalancesCard.tsx
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { createPortal } from 'react-dom';
import {
  ChevronRight, Users, ExternalLink, HandCoins, ArrowUpRight, ArrowDownLeft,
  X, Trash2, Banknote, CreditCard, CheckCircle2, Ban, TrendingDown,
  TriangleAlert,
} from 'lucide-react';
import { api } from '../../convex/_generated/api';
import { cn } from '../utils/cn';
import { formatCurrency } from '../utils/currency';
import { DEFAULT_EXCHANGE_RATES } from '../types';

const SPLITUP_URL = (import.meta as any).env?.VITE_SPLITUP_URL || 'https://splitup.emmettfrett.com';

interface LocalDebt {
  id: string;
  counterparty: string;
  counterpartyKey: string;
  direction: 'iOwe' | 'OwedToMe';
  amountALL: number;
  remainingALL: number;
  status: 'open' | 'resolved';
  note?: string;
  createdAt?: string;
}

interface GroupSummary {
  _id: string;
  name: string;
  currency: string;
  myNetBalanceALL: number;
  memberCount: number;
  isOwner?: boolean;
}

interface GroupMember { _id: string; name: string; userId?: string; }
interface GroupExpense {
  _id: string;
  title: string;
  amount: number;
  amountInALL: number;
  currency: string;
  category?: string;
  paidByMemberId: string;
  splitType: 'equal' | 'exact' | 'shares';
  splits: Array<{ memberId: string; amountALL: number }>;
  timestamp: number;
}
interface GroupSettlement {
  _id: string;
  fromMemberId: string;
  toMemberId: string;
  amountALL: number;
  currency: string;
  paidWith?: 'Cash' | 'Card';
  timestamp: number;
}
interface GroupDetails {
  group: { _id: string; name: string; currency: string; createdBy: string };
  members: GroupMember[];
  expenses: GroupExpense[];
  settlements: GroupSettlement[];
}

interface DebtsAndSharedCardProps {
  localDebts: LocalDebt[];
  onOpenDebtsPanel?: () => void;
}

type SheetTarget =
  | { kind: 'person'; key: string; displayName: string }
  | { kind: 'group'; groupId: string; displayName: string }
  | null;

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

const Pill: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium inline-flex items-center gap-0.5 whitespace-nowrap', className)}>
    {children}
  </span>
);

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const ConfirmDialog: React.FC<{ state: ConfirmState | null; onClose: () => void }> = ({ state, onClose }) => {
  if (!state) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
            <TriangleAlert className="w-5 h-5 text-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900">{state.title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{state.message}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => { state.onConfirm(); onClose(); }}
            className="py-3 rounded-2xl bg-rose-600 text-white text-xs font-bold cursor-pointer hover:bg-rose-700 transition-colors">
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const DebtsAndSharedCard: React.FC<DebtsAndSharedCardProps> = ({ localDebts, onOpenDebtsPanel }) => {
  const groups: GroupSummary[] = useQuery((api as any).groups?.getMyGroups, {}) || [];
  const [target, setTarget] = useState<SheetTarget>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const deleteExpenseMutation = useMutation((api as any).groups?.deleteExpense);

  const prefs = useQuery((api as any).preferences?.getMyPreferences, {}) as { baseCurrency: string } | undefined;
  const baseCurrency: string = prefs?.baseCurrency ?? 'ALL';

  const baseRateToALL: number =
    baseCurrency === 'ALL' ? 1 : (DEFAULT_EXCHANGE_RATES[baseCurrency] ?? 1);

  const fmtBase = (amountALL: number): string => {
    const inBase = baseCurrency === 'ALL'
      ? Math.round(amountALL)
      : Math.round((amountALL / baseRateToALL) * 100) / 100;
    return formatCurrency(inBase, baseCurrency as any);
  };

  const details: GroupDetails | null = useQuery(
    (api as any).groups?.getGroupDetails,
    target?.kind === 'group' ? { groupId: target.groupId as any } : ('skip' as any)
  ) as GroupDetails | null;

  const people = useMemo(() => {
    const map = new Map<string, { key: string; name: string; localNet: number; debtCount: number }>();
    for (const d of localDebts) {
      if (d.status !== 'open') continue;
      const key = d.counterpartyKey;
      let row = map.get(key);
      if (!row) {
        row = { key, name: d.counterparty, localNet: 0, debtCount: 0 };
        map.set(key, row);
      }
      row.localNet += d.direction === 'OwedToMe' ? d.remainingALL : -d.remainingALL;
      row.debtCount += 1;
    }
    return Array.from(map.values()).sort((a, b) => Math.abs(b.localNet) - Math.abs(a.localNet));
  }, [localDebts]);

  const groupRows = useMemo(
    () => [...groups].sort((a, b) => Math.abs(b.myNetBalanceALL) - Math.abs(a.myNetBalanceALL)),
    [groups]
  );

  const combinedNet =
    people.reduce((s, p) => s + p.localNet, 0) +
    groups.reduce((s, g) => s + g.myNetBalanceALL, 0);

  const hasAny = people.length > 0 || groups.length > 0;
  if (!hasAny) return null;

  const handleDeleteGroupExpense = (expId: string, expTitle: string) => {
    setConfirm({
      title: 'Delete this group expense?',
      message: `"${expTitle}" will be removed from the group. Balances recalculate automatically.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteExpenseMutation({ expenseId: expId as any });
        } catch (err) {
          console.warn('Delete expense failed:', err);
        }
      },
    });
  };

  return (
    <>
      <div className="rounded-3xl bg-white border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3 font-sans">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <HandCoins className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Debts</h3>
              <p className="text-[11px] text-slate-500">
                {people.length > 0
                  ? `${people.length} ${people.length === 1 ? 'person' : 'people'}`
                  : 'No personal debts'}
                {groups.length > 0 && ` · ${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn(
              'text-sm font-mono font-bold',
              combinedNet > 0 ? 'text-emerald-600' : combinedNet < 0 ? 'text-rose-600' : 'text-slate-400'
            )}>
              {combinedNet === 0 ? 'Settled' : `${combinedNet > 0 ? '+' : '−'}${fmtBase(Math.abs(combinedNet))}`}
            </p>
            <p className="text-[10px] text-slate-400">
              {combinedNet > 0 ? 'net owed to you' : combinedNet < 0 ? 'net you owe' : 'all even'}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          {people.map((p) => (
            <button
              key={`person-${p.key}`}
              type="button"
              onClick={() => setTarget({ kind: 'person', key: p.key, displayName: p.name })}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-slate-700">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-800 truncate">{p.name}</span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {p.debtCount} {p.debtCount === 1 ? 'debt' : 'debts'}
                </span>
              </div>
              <span className={cn(
                'text-xs font-mono font-bold shrink-0',
                p.localNet > 0 ? 'text-emerald-600' : p.localNet < 0 ? 'text-rose-600' : 'text-slate-400'
              )}>
                {p.localNet === 0 ? '—' : fmtBase(Math.abs(p.localNet))}
              </span>
            </button>
          ))}

          {groupRows.map((g) => (
            <button
              key={`group-${g._id}`}
              type="button"
              onClick={() => setTarget({ kind: 'group', groupId: g._id, displayName: g.name })}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="text-xs font-semibold text-slate-800 truncate">{g.name}</span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
                </span>
              </div>
              <span className={cn(
                'text-xs font-mono font-bold shrink-0',
                g.myNetBalanceALL > 0 ? 'text-emerald-600' : g.myNetBalanceALL < 0 ? 'text-rose-600' : 'text-slate-400'
              )}>
                {g.myNetBalanceALL === 0 ? '—' : fmtBase(Math.abs(g.myNetBalanceALL))}
              </span>
            </button>
          ))}
        </div>
      </div>

      {target && (
        <div
          onClick={() => setTarget(null)}
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[80vh] sm:max-h-[750px] flex flex-col bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden min-h-0 font-sans"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-200 shrink-0 bg-white">
              <div className="flex items-center gap-2 min-w-0">
                {target.kind === 'person' ? (
                  <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-slate-700">
                      {target.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-indigo-600" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 truncate">{target.displayName}</h2>
                  <p className="text-[10px] text-slate-400">
                    {target.kind === 'person' ? 'Personal debts' : 'Shared group activity'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5 touch-pan-y">
              {target.kind === 'person' ? (
                (() => {
                  const personDebts = localDebts.filter((d) => d.counterpartyKey === target.key);
                  if (personDebts.length === 0) {
                    return <p className="text-xs text-slate-400 text-center py-6">No debts recorded.</p>;
                  }
                  return (
                    <>
                      {personDebts.map((d) => {
                        const isOpen = d.status === 'open';
                        const owedToMe = d.direction === 'OwedToMe';
                        return (
                          <div
                            key={d.id}
                            className={cn(
                              'p-3 rounded-2xl border shadow-sm flex items-center justify-between gap-2',
                              isOpen ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={cn(
                                'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border',
                                owedToMe ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                              )}>
                                {owedToMe ? (
                                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Pill className={owedToMe ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}>
                                    {owedToMe ? 'Owes you' : 'You owe'}
                                  </Pill>
                                  {!isOpen && (
                                    <Pill className="bg-slate-100 text-slate-500 border border-slate-200">
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      Resolved
                                    </Pill>
                                  )}
                                </div>
                                {d.note && (
                                  <p className="text-[11px] text-slate-500 italic truncate mt-0.5">
                                    {d.note}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <p className={cn(
                                'text-sm font-mono font-bold',
                                isOpen ? (owedToMe ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-400 line-through'
                              )}>
                                {fmtBase(d.remainingALL)}
                              </p>
                              {onOpenDebtsPanel && (
                                <button
                                  type="button"
                                  onClick={() => { setTarget(null); onOpenDebtsPanel(); }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                  title="Edit in Debts panel"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {onOpenDebtsPanel && (
                        <button
                          type="button"
                          onClick={() => { setTarget(null); onOpenDebtsPanel(); }}
                          className="w-full mt-2 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          Manage in Debts panel →
                        </button>
                      )}
                    </>
                  );
                })()
              ) : !details ? (
                <p className="text-xs text-slate-400 text-center py-6">Loading activity…</p>
              ) : (
                (() => {
                  const memberName = new Map(details.members.map((m) => [m._id, m.name]));
                  const items = [
                    ...details.expenses.map((e) => ({ kind: 'expense' as const, e })),
                    ...details.settlements.map((s) => ({ kind: 'settlement' as const, s })),
                  ].sort((a, b) => {
                    const ta = a.kind === 'expense' ? a.e.timestamp : a.s.timestamp;
                    const tb = b.kind === 'expense' ? b.e.timestamp : b.s.timestamp;
                    return tb - ta;
                  });

                  if (items.length === 0) {
                    return <p className="text-xs text-slate-400 text-center py-6">No activity yet.</p>;
                  }

                  return (
                    <>
                      {items.map((item) => {
                        if (item.kind === 'expense') {
                          const exp = item.e;
                          const paidBy = memberName.get(exp.paidByMemberId) ?? 'Someone';
                          return (
                            <div
                              key={`e-${exp._id}`}
                              className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 shadow-sm"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-semibold text-slate-900 truncate">
                                      {exp.title}
                                    </span>
                                    <Pill className="bg-emerald-100 text-emerald-800">👥 {details.group.name}</Pill>
                                  </div>
                                  <div className="flex items-center gap-1 flex-wrap mt-1">
                                    <Pill className="bg-slate-100 text-slate-700">Expense</Pill>
                                    <Pill className="bg-rose-50 text-rose-700">
                                      <CreditCard className="w-2.5 h-2.5" />
                                      Card
                                    </Pill>
                                    <Pill className="bg-emerald-50 text-emerald-700">
                                      <TrendingDown className="w-2.5 h-2.5" />
                                      Spent
                                    </Pill>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Paid by {paidBy} · {relativeTime(exp.timestamp)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <div className="text-right">
                                  <p className="text-sm font-mono font-bold text-slate-900">
                                    {formatCurrency(exp.amount, exp.currency as any)}
                                  </p>
                                  {exp.currency !== 'ALL' && (
                                    <p className="text-[10px] font-mono text-emerald-600">
                                      ≈ {fmtBase(exp.amountInALL)}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGroupExpense(exp._id, exp.title)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Delete expense"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        }
                        const s = item.s;
                        const fromName = memberName.get(s.fromMemberId) ?? 'Someone';
                        const toName = memberName.get(s.toMemberId) ?? 'Someone';
                        return (
                          <div
                            key={`s-${s._id}`}
                            className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 shadow-sm"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                                <HandCoins className="w-3.5 h-3.5 text-amber-600" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-slate-900 truncate">
                                    {fromName} paid {toName}
                                  </span>
                                  <Pill className="bg-emerald-100 text-emerald-800">👥 {details.group.name}</Pill>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap mt-1">
                                  <Pill className="bg-amber-50 text-amber-700">Settlement</Pill>
                                  <Pill className="bg-slate-100 text-slate-600">
                                    {s.paidWith === 'Cash' ? (
                                      <><Banknote className="w-2.5 h-2.5" />Cash</>
                                    ) : (
                                      <><CreditCard className="w-2.5 h-2.5" />Card</>
                                    )}
                                  </Pill>
                                  <Pill className="bg-slate-100 text-slate-500 border border-slate-200">
                                    <Ban className="w-2.5 h-2.5" />
                                    Not spent
                                  </Pill>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">{relativeTime(s.timestamp)}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className="text-sm font-mono font-bold text-amber-700">
                                {fmtBase(s.amountALL)}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      <a
                        href={`${SPLITUP_URL}/?groupId=${details.group._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline mt-2"
                      >
                        Open in Splitup <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};