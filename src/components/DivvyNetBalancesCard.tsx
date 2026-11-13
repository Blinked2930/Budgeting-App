// src/components/DivvyNetBalancesCard.tsx
import React, { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { ChevronRight, Users, HandCoins } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import { cn } from '../utils/cn';
import { convertFromALL, formatCurrency } from '../utils/currency';
import { useCurrency } from '../hooks/useCurrency';
import type { Currency } from '../types';

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
  myNetBalanceGroup?: number;
  myNetBalanceALL: number;
  memberCount: number;
  isOwner?: boolean;
}

interface DebtsAndSharedCardProps {
  localDebts: LocalDebt[];
  onOpenDebtsPanel?: (counterparty?: string) => void;
}

export const DebtsAndSharedCard: React.FC<DebtsAndSharedCardProps> = ({ localDebts, onOpenDebtsPanel }) => {
  const groups: GroupSummary[] = useQuery((api as any).groups?.getMyGroups, {}) || [];
  const prefs = useQuery((api as any).preferences?.getMyPreferences, {}) as { baseCurrency: string } | undefined;
  const { currency: activeCurrency } = useCurrency();

  const displayCurrency: Currency = (activeCurrency || prefs?.baseCurrency || 'ALL') as Currency;

  const fmtDisplay = (amountALL: number): string => {
    const converted = convertFromALL(amountALL, displayCurrency);
    return formatCurrency(converted, displayCurrency);
  };

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

  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3 font-sans">
      <div
        className="flex items-center justify-between cursor-pointer group"
        onClick={() => onOpenDebtsPanel?.()}
      >
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
            <HandCoins className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Debts</h3>
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
            {combinedNet === 0 ? 'Settled' : `${combinedNet > 0 ? '+' : '−'}${fmtDisplay(Math.abs(combinedNet))}`}
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
            onClick={() => onOpenDebtsPanel?.(p.name)}
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
              {p.localNet === 0 ? '—' : fmtDisplay(Math.abs(p.localNet))}
            </span>
          </button>
        ))}

        {groupRows.map((g) => {
          const grpCurrency = (g.currency || 'ALL').toUpperCase() as Currency;
          const nativeNet =
            typeof g.myNetBalanceGroup === 'number'
              ? g.myNetBalanceGroup
              : convertFromALL(g.myNetBalanceALL, grpCurrency);
          const showConvertedHint = grpCurrency !== displayCurrency && g.myNetBalanceALL !== 0;

          return (
            <button
              key={`group-${g._id}`}
              type="button"
              onClick={() => onOpenDebtsPanel?.(g.name)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="text-xs font-semibold text-slate-800 truncate">{g.name}</span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
                </span>
                {grpCurrency !== displayCurrency && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                    {grpCurrency}
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className={cn(
                  'block text-xs font-mono font-bold',
                  nativeNet > 0 ? 'text-emerald-600' : nativeNet < 0 ? 'text-rose-600' : 'text-slate-400'
                )}>
                  {nativeNet === 0
                    ? '—'
                    : `${nativeNet > 0 ? '+' : '−'}${formatCurrency(Math.abs(nativeNet), grpCurrency)}`}
                </span>
                {showConvertedHint && (
                  <span className="block text-[9px] font-mono text-slate-400">
                    ≈ {fmtDisplay(Math.abs(g.myNetBalanceALL))}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};