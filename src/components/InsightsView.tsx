// src/components/InsightsView.tsx
import React, { useMemo, useState } from 'react';
import {
    ListFilter,
    Banknote,
    CreditCard,
    HandCoins,
    PieChart,
    History,
    PiggyBank,
    TrendingUp,
    TrendingDown,
    ArrowRightLeft,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CATEGORIES, type Category, type ExpenseRecord } from '../types';
import { useExpenses } from '../hooks/useExpenses';
import { useBudgetCycle } from '../hooks/useBudgetCycle';
import { useDebts } from '../hooks/useDebts';
import { useCurrency } from '../hooks/useCurrency';
import { db } from '../db';
import {
    DEFAULT_FILTERS,
    aggregate,
    aggregateByCategory,
    aggregatePaidWith,
    cashFlow,
    totalOutflow,
    spendAgainstBudget,
    filterExpenses,
    getMonthOptions,
    monthLabel,
    type InsightFilters,
} from '../utils/insights';
import { parseLocalDate } from '../utils/budget';
import { cn } from '../utils/cn';
import { DebtsPanel } from './DebtsPanel';

type TimeScope = 'cycle' | '30d' | 'all';

const SCOPES: { id: TimeScope; label: string }[] = [
    { id: 'cycle', label: 'This Cycle' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'all', label: 'All Time' },
];

const CATEGORY_COLORS: Record<Category, { bar: string; text: string; dot: string }> = {
    Food: { bar: 'bg-emerald-400', text: 'text-emerald-700', dot: 'bg-emerald-400' },
    Utilities: { bar: 'bg-amber-400', text: 'text-amber-700', dot: 'bg-amber-400' },
    Transport: { bar: 'bg-cyan-400', text: 'text-cyan-700', dot: 'bg-cyan-400' },
    Social: { bar: 'bg-purple-400', text: 'text-purple-700', dot: 'bg-purple-400' },
    Travel: { bar: 'bg-rose-400', text: 'text-rose-700', dot: 'bg-rose-400' },
    Other: { bar: 'bg-slate-400', text: 'text-slate-700', dot: 'bg-slate-400' },
};

const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
    <div className="flex items-center gap-1.5 px-1 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {icon}
        <h2>{children}</h2>
    </div>
);

const Card: React.FC<{
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}> = ({ children, className, onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            'p-4 rounded-2xl bg-white border border-slate-200 shadow-sm',
            onClick && 'cursor-pointer hover:border-emerald-300 transition-colors',
            className
        )}
    >
        {children}
    </div>
);

const ChipRow: React.FC<{
    label: string;
    options: { value: string; label: string }[];
    selected: string;
    onSelect: (value: string) => void;
}> = ({ label, options, selected, onSelect }) => (
    <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</p>
        <div className="flex flex-wrap gap-1.5">
            {[{ value: 'all', label: 'All' }, ...options].map((opt) => {
                const isSelected = opt.value === selected;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onSelect(opt.value)}
                        className={cn(
                            'px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer',
                            isSelected
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
                        )}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    </div>
);

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="mt-0.5 text-base font-mono font-bold text-slate-900 tracking-tight">{value}</p>
    </div>
);

const CategoryBreakdown: React.FC<{ expenses: ExpenseRecord[] }> = ({ expenses }) => {
    const stats = useMemo(() => aggregateByCategory(expenses), [expenses]);
    const { format } = useCurrency();

    if (stats.length === 0) {
        return <Card><p className="text-xs text-slate-500">Log some expenses to see where your money went.</p></Card>;
    }

    const grandTotal = stats.reduce((s, c) => s + c.total, 0);

    return (
        <Card className="space-y-3">
            <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total</span>
                <span className="text-base font-mono font-bold text-slate-900">{format(grandTotal)}</span>
            </div>

            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
                {stats.map((c) => (
                    <div key={c.category} className={cn('h-full', CATEGORY_COLORS[c.category].bar)} style={{ width: `${c.percent}%` }} />
                ))}
            </div>

            <div className="space-y-1.5">
                {stats.map((c) => (
                    <div key={c.category} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', CATEGORY_COLORS[c.category].dot)} />
                            <span className={cn('font-semibold truncate', CATEGORY_COLORS[c.category].text)}>{c.category}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{c.count}×</span>
                        </div>
                        <div className="flex items-center gap-2.5 font-mono shrink-0">
                            <span className="text-[10px] text-slate-400">{c.percent.toFixed(0)}%</span>
                            <span className="font-bold text-slate-900 text-[11px]">{format(c.total)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const SpendPaceCard: React.FC<{ timeScope: TimeScope }> = ({ timeScope }) => {
    const { stats } = useBudgetCycle();
    const { format } = useCurrency();

    if (!stats) {
        return (
            <Card>
                <p className="text-xs text-slate-500">Set up a budget cycle to see your spending pace.</p>
            </Card>
        );
    }

    const daysElapsed = stats.dayNumber;
    const daysTotal = stats.totalDays;
    const projectedByNow = (stats.cycleBudget / daysTotal) * daysElapsed;
    const pace = projectedByNow > 0 ? (stats.consumed / projectedByNow) * 100 : 0;
    const isOverPace = pace > 100;
    const barWidth = Math.min(100, Math.max(0, pace));

    return (
        <Card className="space-y-3">
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-1.5">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Pace</p>
                        {timeScope !== 'cycle' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                                Current cycle
                            </span>
                        )}
                    </div>
                    <p className={cn(
                        'text-lg font-mono font-bold mt-0.5 flex items-center gap-1',
                        isOverPace ? 'text-rose-600' : 'text-emerald-600'
                    )}>
                        {isOverPace ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {pace.toFixed(0)}%
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        {isOverPace ? 'ahead of' : 'behind'} pace by {format(Math.abs(stats.consumed - projectedByNow))}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Day</p>
                    <p className="text-sm font-mono font-bold text-slate-900">{daysElapsed} of {daysTotal}</p>
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden relative">
                    <div className="absolute top-0 bottom-0 w-px bg-slate-400 z-10" style={{ left: `${(daysElapsed / daysTotal) * 100}%` }} />
                    <div
                        className={cn('h-full rounded-full transition-all', isOverPace ? 'bg-rose-500' : 'bg-emerald-500')}
                        style={{ width: `${barWidth}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>{format(stats.consumed)} spent</span>
                    <span>{format(projectedByNow)} expected</span>
                </div>
            </div>
        </Card>
    );
};

const PaymentBehaviorCard: React.FC<{ expenses: ExpenseRecord[] }> = ({ expenses }) => {
    const paidWith = useMemo(() => aggregatePaidWith(expenses), [expenses]);
    const { format } = useCurrency();

    if (paidWith.cash + paidWith.card === 0) {
        return (
            <Card>
                <p className="text-xs text-slate-500">Log some expenses to see your cash vs card habits.</p>
            </Card>
        );
    }

    return (
        <Card className="space-y-3">
            <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cash vs Card</span>
                <span className="text-base font-mono font-bold text-slate-900">{format(paidWith.cash + paidWith.card)}</span>
            </div>

            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
                <div className="h-full bg-teal-400" style={{ width: `${paidWith.cashPct}%` }} />
                <div className="h-full bg-rose-400" style={{ width: `${paidWith.cardPct}%` }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="p-2 rounded-xl bg-teal-50/50 border border-teal-100">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-teal-700 uppercase tracking-wider">
                        <Banknote className="w-3 h-3" />
                        Cash
                    </div>
                    <p className="text-sm font-mono font-bold text-teal-800 mt-0.5">{format(paidWith.cash)}</p>
                    <p className="text-[10px] text-teal-600 font-mono">{paidWith.cashPct.toFixed(0)}%</p>
                </div>
                <div className="p-2 rounded-xl bg-rose-50/50 border border-rose-100">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-700 uppercase tracking-wider">
                        <CreditCard className="w-3 h-3" />
                        Card
                    </div>
                    <p className="text-sm font-mono font-bold text-rose-800 mt-0.5">{format(paidWith.card)}</p>
                    <p className="text-[10px] text-rose-600 font-mono">{paidWith.cardPct.toFixed(0)}%</p>
                </div>
            </div>
        </Card>
    );
};

const CashFlowCard: React.FC<{ expenses: ExpenseRecord[] }> = ({ expenses }) => {
    const { format } = useCurrency();
    const flow = useMemo(() => cashFlow(expenses), [expenses]);

    return (
        <Card className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Cash Flow (Loans & Repayments)
                </span>
                <span className={cn('text-base font-mono font-bold', flow.netALL >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                    {flow.netALL > 0 ? '+' : ''}{format(flow.netALL)}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">
                        <ArrowRightLeft className="w-3 h-3" />
                        In
                    </div>
                    <p className="text-sm font-mono font-bold text-emerald-800">{format(flow.inALL)}</p>
                    <p className="text-[10px] text-emerald-600">Repayments received</p>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-700 uppercase tracking-wider mb-1">
                        <ArrowRightLeft className="w-3 h-3" />
                        Out
                    </div>
                    <p className="text-sm font-mono font-bold text-rose-800">{format(flow.outALL)}</p>
                    <p className="text-[10px] text-rose-600">Loans given</p>
                </div>
            </div>
        </Card>
    );
};

const DebtSummary: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
    const { openDebts } = useDebts();
    const { format } = useCurrency();

    const totals = useMemo(() => {
        let receivables = 0;
        let payables = 0;
        for (const d of openDebts) {
            if (d.direction === 'OwedToMe') receivables += d.remainingALL;
            else payables += d.remainingALL;
        }
        return { receivables, payables, net: receivables - payables };
    }, [openDebts]);

    if (openDebts.length === 0) {
        return (
            <Card>
                <p className="text-xs text-slate-500">No open debts.</p>
            </Card>
        );
    }

    return (
        <Card className="space-y-3" onClick={onOpen}>
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">Debts</p>
                <span className="text-[10px] text-indigo-500 underline">Manage →</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Owed to you</p>
                    <p className="text-sm font-mono font-bold text-emerald-600 mt-0.5">
                        {format(totals.receivables)}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">You owe</p>
                    <p className="text-sm font-mono font-bold text-rose-600 mt-0.5">
                        {format(totals.payables)}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Net</p>
                    <p className={cn('text-sm font-mono font-bold mt-0.5', totals.net > 0 ? 'text-emerald-600' : totals.net < 0 ? 'text-rose-600' : 'text-slate-500')}>
                        {totals.net > 0 ? '+' : ''}{format(Math.abs(totals.net))}
                    </p>
                </div>
            </div>
        </Card>
    );
};

const CycleHistorySection: React.FC = () => {
    const { format } = useCurrency();

    const allCycles = useLiveQuery(
        () => db.budgetCycles.orderBy('startDate').reverse().filter((c) => !c.deleted).toArray(),
        []
    );

    if (!allCycles || allCycles.length <= 1) {
        return (
            <Card>
                <p className="text-xs text-slate-500">
                    No past cycles yet. Once you start your next cycle, your surplus and rollovers will appear here.
                </p>
            </Card>
        );
    }

    const pastCycles = allCycles.slice(1);

    return (
        <Card className="p-0 overflow-hidden divide-y divide-slate-100">
            {pastCycles.map((cycle) => {
                const surplus = cycle.bufferPoolALL + cycle.travelStashALL;
                return (
                    <div key={cycle.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-slate-900">
                                    {new Date(cycle.startDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    {new Date(cycle.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(cycle.targetEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Stipend</p>
                                <p className="text-sm font-mono font-bold text-slate-900">{format(cycle.stipendAmountALL)}</p>
                            </div>
                        </div>

                        {surplus > 0 && (
                            <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-2.5 border border-emerald-100">
                                <PiggyBank className="w-4 h-4 text-emerald-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-emerald-800">
                                        Saved {format(surplus)}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-emerald-700 font-mono">
                                        <span>Buffer: {format(cycle.bufferPoolALL)}</span>
                                        <span>Travel Stash: {format(cycle.travelStashALL)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </Card>
    );
};

function filterByScope(
    expenses: ExpenseRecord[],
    scope: TimeScope,
    cycleStart?: string
): ExpenseRecord[] {
    const now = Date.now();

    return expenses.filter((e) => {
        if (e.deleted) return false;
        const when = new Date(e.timestamp).getTime();

        if (scope === 'all') return true;

        if (scope === '30d') {
            return now - when <= 30 * 24 * 60 * 60 * 1000;
        }

        if (cycleStart) {
            const cycleMs = parseLocalDate(cycleStart).getTime();
            return when >= cycleMs;
        }
        return true;
    });
}

export const InsightsView: React.FC = () => {
    const { expenses } = useExpenses();
    const { cycle } = useBudgetCycle();
    const { format } = useCurrency();
    const [timeScope, setTimeScope] = useState<TimeScope>('cycle');
    const [filters, setFilters] = useState<InsightFilters>(DEFAULT_FILTERS);
    const [isDebtsOpen, setIsDebtsOpen] = useState(false);

    const scopedExpenses = useMemo(
        () => filterByScope(expenses, timeScope, cycle?.startDate),
        [expenses, timeScope, cycle?.startDate]
    );

    const filtered = useMemo(() => filterExpenses(scopedExpenses, filters), [scopedExpenses, filters]);
    const filteredAgg = useMemo(() => aggregate(filtered), [filtered]);
    const monthOptions = useMemo(() => getMonthOptions(scopedExpenses), [scopedExpenses]);
    const outflow = useMemo(() => totalOutflow(scopedExpenses), [scopedExpenses]);
    const spendBudget = useMemo(() => spendAgainstBudget(scopedExpenses), [scopedExpenses]);

    const update = (key: keyof InsightFilters) => (value: string) =>
        setFilters((prev) => ({ ...prev, [key]: value }));

    const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

    return (
        <div className="w-full max-w-md mx-auto px-4 py-4 space-y-6">
            <DebtsPanel isOpen={isDebtsOpen} onClose={() => setIsDebtsOpen(false)} />

            <div className="sticky top-0 -mx-4 px-4 pt-3 pb-3 bg-slate-50 z-10 border-b border-slate-200/60">
                <div className="flex items-center p-1 rounded-2xl bg-slate-100 border border-slate-200">
                    {SCOPES.map((s) => {
                        const active = timeScope === s.id;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setTimeScope(s.id)}
                                className={cn(
                                    'flex-1 py-2 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer',
                                    active
                                        ? 'bg-white text-emerald-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                {s.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <section>
                <SectionTitle icon={<HandCoins className="w-3.5 h-3.5 text-slate-400" />}>
                    Debts Overview
                </SectionTitle>
                <DebtSummary onOpen={() => setIsDebtsOpen(true)} />
            </section>

            <section>
                <SectionTitle icon={<TrendingUp className="w-3.5 h-3.5 text-slate-400" />}>
                    Spend Pace
                </SectionTitle>
                <SpendPaceCard timeScope={timeScope} />
            </section>

            <section>
                <SectionTitle icon={<PieChart className="w-3.5 h-3.5 text-slate-400" />}>
                    Outflow & Budget
                </SectionTitle>
                <Card className="space-y-2">
                    <div className="flex items-baseline justify-between">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Budgeted spend</span>
                        <span className="text-lg font-mono font-bold text-slate-900">{format(spendBudget)}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                        {timeScope === 'cycle'
                            ? 'Regular consumption this cycle (matches the "spent" number on the Budget tab). Excludes rent, loans, and reconciliation corrections.'
                            : timeScope === '30d'
                                ? 'Regular consumption across the last 30 days. Excludes rent, loans, and reconciliation corrections.'
                                : 'Regular consumption across all logged time. Excludes rent, loans, and reconciliation corrections.'}
                    </p>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total outflow</span>
                        <span className="text-sm font-mono font-bold text-slate-700">{format(outflow)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                        Every penny that left your wallet, including rent. Excludes loans and reconciliation.
                    </p>
                </Card>
            </section>

            <section>
                <SectionTitle icon={<Banknote className="w-3.5 h-3.5 text-slate-400" />}>
                    Cash vs Card
                </SectionTitle>
                <PaymentBehaviorCard expenses={scopedExpenses} />
            </section>

            <section>
                <SectionTitle icon={<ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />}>
                    Cash Flow
                </SectionTitle>
                <CashFlowCard expenses={scopedExpenses} />
            </section>

            <section>
                <SectionTitle icon={<PieChart className="w-3.5 h-3.5 text-slate-400" />}>
                    Where your money went
                </SectionTitle>
                <CategoryBreakdown expenses={scopedExpenses} />
            </section>

            <section>
                <SectionTitle icon={<ListFilter className="w-3.5 h-3.5 text-slate-400" />}>
                    Explore your data
                </SectionTitle>
                <Card className="space-y-4">
                    <ChipRow
                        label="Category"
                        options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                        selected={filters.category}
                        onSelect={update('category')}
                    />
                    <ChipRow
                        label="Payment Source"
                        options={[{ value: 'Cash', label: 'Cash' }, { value: 'Card', label: 'Card' }]}
                        selected={filters.paidWith}
                        onSelect={update('paidWith')}
                    />
                    {monthOptions.length > 0 && (
                        <ChipRow
                            label="Month"
                            options={monthOptions
                                .slice(0, 6)
                                .map((m) => ({ value: m, label: monthLabel(m) }))}
                            selected={filters.month}
                            onSelect={update('month')}
                        />
                    )}

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={() => setFilters(DEFAULT_FILTERS)}
                            className="text-[11px] text-emerald-600 hover:underline cursor-pointer"
                        >
                            Clear filters
                        </button>
                    )}

                    <div className="pt-3 border-t border-slate-100">
                        {filtered.length === 0 ? (
                            <p className="text-xs text-slate-500">
                                No expenses match these filters.
                            </p>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <Metric label="Total" value={format(filteredAgg.total)} />
                                <Metric label="Entries" value={String(filteredAgg.count)} />
                                <Metric label="Average" value={format(filteredAgg.average)} />
                            </div>
                        )}
                    </div>
                </Card>
                <p className="text-[10px] text-slate-400 px-1 mt-2">
                    Totals use each expense's value converted to your current currency.
                </p>
            </section>

            <section>
                <SectionTitle icon={<History className="w-3.5 h-3.5 text-slate-400" />}>
                    Past Cycles
                </SectionTitle>
                <CycleHistorySection />
            </section>
        </div>
    );
};
