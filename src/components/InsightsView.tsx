// src/components/InsightsView.tsx
import React, { useMemo, useState } from 'react';
import {
    ListFilter,
    Store,
    Utensils,
    Banknote,
    CreditCard,
    HandCoins,
    PieChart,
    History,
    PiggyBank,
    CalendarDays,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CATEGORIES, type Category, type ExpenseRecord } from '../types';
import { useExpenses } from '../hooks/useExpenses';
import { useBudgetCycle } from '../hooks/useBudgetCycle';
import { useDebts } from '../hooks/useDebts';
import { db } from '../db';
import {
    DEFAULT_FILTERS,
    aggregate,
    aggregateByCategory,
    aggregateByVendor,
    aggregatePaidWith,
    calculateFoodDailyStats,
    filterExpenses,
    getMonthOptions,
    monthLabel,
    type InsightFilters,
} from '../utils/insights';
import { formatCurrency } from '../utils/currency';
import { cn } from '../utils/cn';
import { DebtsPanel } from './DebtsPanel';

const CATEGORY_COLORS: Record<Category, { bar: string; text: string; dot: string }> = {
    Food: { bar: 'bg-emerald-400', text: 'text-emerald-700', dot: 'bg-emerald-400' },
    Utilities: { bar: 'bg-amber-400', text: 'text-amber-700', dot: 'bg-amber-400' },
    Transport: { bar: 'bg-cyan-400', text: 'text-cyan-700', dot: 'bg-cyan-400' },
    Social: { bar: 'bg-purple-400', text: 'text-purple-700', dot: 'bg-purple-400' },
    Travel: { bar: 'bg-rose-400', text: 'text-rose-700', dot: 'bg-rose-400' },
    Other: { bar: 'bg-slate-400', text: 'text-slate-700', dot: 'bg-slate-400' },
};

const VENDOR_COLORS: Record<string, { bar: string; text: string; dot: string }> = {
    Pazar: { bar: 'bg-emerald-400', text: 'text-emerald-700', dot: 'bg-emerald-400' },
    Supermarket: { bar: 'bg-cyan-400', text: 'text-cyan-700', dot: 'bg-cyan-400' },
    'Café': { bar: 'bg-purple-400', text: 'text-purple-700', dot: 'bg-purple-400' },
    Bakery: { bar: 'bg-amber-400', text: 'text-amber-700', dot: 'bg-amber-400' },
    Restaurant: { bar: 'bg-rose-400', text: 'text-rose-700', dot: 'bg-rose-400' },
    Other: { bar: 'bg-slate-400', text: 'text-slate-700', dot: 'bg-slate-400' },
};

const getVendorColor = (vendor: string) =>
    VENDOR_COLORS[vendor] ?? { bar: 'bg-slate-400', text: 'text-slate-700', dot: 'bg-slate-400' };

const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
    <div className="flex items-center gap-1.5 px-1 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {icon}
        <h2>{children}</h2>
    </div>
);

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className, onClick }) => (
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
    const paidWith = useMemo(() => aggregatePaidWith(expenses), [expenses]);

    if (stats.length === 0) {
        return <Card><p className="text-xs text-slate-500">Log some expenses to see where your money went.</p></Card>;
    }

    const grandTotal = stats.reduce((s, c) => s + c.total, 0);

    return (
        <Card className="space-y-3">
            <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total</span>
                <span className="text-base font-mono font-bold text-slate-900">{formatCurrency(grandTotal, 'ALL')}</span>
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
                            <span className="font-bold text-slate-900 text-[11px]">{formatCurrency(c.total, 'ALL')}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Paid with</span>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                    <span className="flex items-center gap-1">
                        <Banknote className="w-3 h-3 text-teal-600" />
                        <span className="text-slate-500">Cash</span>
                        <span className="text-teal-700 font-semibold">{paidWith.cashPct.toFixed(0)}%</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-rose-500" />
                        <span className="text-slate-500">Card</span>
                        <span className="text-rose-700 font-semibold">{paidWith.cardPct.toFixed(0)}%</span>
                    </span>
                </div>
            </div>
        </Card>
    );
};

const VendorBreakdown: React.FC<{ expenses: ExpenseRecord[] }> = ({ expenses }) => {
    const stats = useMemo(() => aggregateByVendor(expenses), [expenses]);

    if (stats.length === 0) {
        return (
            <Card>
                <p className="text-xs text-slate-500">
                    Log some expenses with a vendor to see where you spend most.
                </p>
            </Card>
        );
    }

    const top = stats.slice(0, 6);
    const grandTotal = stats.reduce((s, v) => s + v.total, 0);

    return (
        <Card className="space-y-3">
            <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total</span>
                <span className="text-base font-mono font-bold text-slate-900">{formatCurrency(grandTotal, 'ALL')}</span>
            </div>

            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
                {top.map((v) => (
                    <div key={v.vendor} className={cn('h-full', getVendorColor(v.vendor).bar)} style={{ width: `${v.percent}%` }} />
                ))}
            </div>

            <div className="space-y-1.5">
                {top.map((v) => {
                    const c = getVendorColor(v.vendor);
                    return (
                        <div key={v.vendor} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className={cn('w-2 h-2 rounded-full shrink-0', c.dot)} />
                                <span className={cn('font-semibold truncate', c.text)}>{v.vendor}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{v.count}×</span>
                            </div>
                            <div className="flex items-center gap-2.5 font-mono shrink-0">
                                <span className="text-[10px] text-slate-400">{v.percent.toFixed(0)}%</span>
                                <span className="font-bold text-slate-900 text-[11px]">{formatCurrency(v.total, 'ALL')}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

const DebtSummary: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
    const { openDebts } = useDebts();

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
                        {formatCurrency(totals.receivables, 'ALL')}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">You owe</p>
                    <p className="text-sm font-mono font-bold text-rose-600 mt-0.5">
                        {formatCurrency(totals.payables, 'ALL')}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Net</p>
                    <p className={cn('text-sm font-mono font-bold mt-0.5', totals.net > 0 ? 'text-emerald-600' : totals.net < 0 ? 'text-rose-600' : 'text-slate-500')}>
                        {totals.net > 0 ? '+' : ''}{formatCurrency(Math.abs(totals.net), 'ALL')}
                    </p>
                </div>
            </div>
        </Card>
    );
};

const CycleHistorySection: React.FC = () => {
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
                                <p className="text-sm font-mono font-bold text-slate-900">{formatCurrency(cycle.stipendAmountALL, 'ALL')}</p>
                            </div>
                        </div>

                        {surplus > 0 && (
                            <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-2.5 border border-emerald-100">
                                <PiggyBank className="w-4 h-4 text-emerald-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-emerald-800">
                                        Saved {formatCurrency(surplus, 'ALL')}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-emerald-700 font-mono">
                                        <span>Buffer: {formatCurrency(cycle.bufferPoolALL, 'ALL')}</span>
                                        <span>Travel Stash: {formatCurrency(cycle.travelStashALL, 'ALL')}</span>
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

export const InsightsView: React.FC = () => {
    const { expenses } = useExpenses();
    const { cycle } = useBudgetCycle();
    const [filters, setFilters] = useState<InsightFilters>(DEFAULT_FILTERS);
    const [isDebtsOpen, setIsDebtsOpen] = useState(false);

    const overall = useMemo(() => aggregate(expenses), [expenses]);
    const monthOptions = useMemo(() => getMonthOptions(expenses), [expenses]);
    const filtered = useMemo(() => filterExpenses(expenses, filters), [expenses, filters]);
    const filteredAgg = useMemo(() => aggregate(filtered), [filtered]);

    const dailyFoodStats = useMemo(
        () => calculateFoodDailyStats(expenses, cycle?.startDate),
        [expenses, cycle?.startDate]
    );

    const update = (key: keyof InsightFilters) => (value: string) =>
        setFilters((prev) => ({ ...prev, [key]: value }));

    const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

    return (
        <div className="w-full max-w-md mx-auto px-4 py-4 space-y-6">
            <DebtsPanel isOpen={isDebtsOpen} onClose={() => setIsDebtsOpen(false)} />

            <section>
                <SectionTitle icon={<HandCoins className="w-3.5 h-3.5 text-slate-400" />}>
                    Debts Overview
                </SectionTitle>
                <DebtSummary onOpen={() => setIsDebtsOpen(true)} />
            </section>

            <section>
                <SectionTitle icon={<PieChart className="w-3.5 h-3.5 text-slate-400" />}>
                    Where your money went
                </SectionTitle>
                <CategoryBreakdown expenses={expenses} />
            </section>

            <section>
                <SectionTitle icon={<Store className="w-3.5 h-3.5 text-slate-400" />}>
                    Where you spend most
                </SectionTitle>
                <VendorBreakdown expenses={expenses} />
            </section>

            <section>
                <SectionTitle icon={<Utensils className="w-3.5 h-3.5 text-slate-400" />}>
                    Cost per meal
                </SectionTitle>
                <Card className="space-y-4 divide-y divide-slate-100">
                    <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Tagged Average</p>
                        {overall.costPerMeal !== null ? (
                            <div className="flex items-end justify-between gap-3">
                                <div>
                                    <p className="text-2xl font-mono font-extrabold text-emerald-600 tracking-tight">
                                        {formatCurrency(overall.costPerMeal, 'ALL')}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        based on {overall.meals} manually tagged meals
                                    </p>
                                </div>
                                <p className="text-[11px] font-mono text-slate-400 text-right">
                                    {formatCurrency(overall.mealSpend, 'ALL')}
                                    <br />
                                    total spend
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500">
                                Add an estimated meal count in Advanced Entry when you log food, and your
                                average cost per meal will show up here.
                            </p>
                        )}
                    </div>

                    <div className="pt-4">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <CalendarDays className="w-3 h-3" />
                            Daily Food Burn (est. 3 meals/day)
                        </p>
                        {dailyFoodStats ? (
                            <div className="flex items-end justify-between gap-3">
                                <div>
                                    <p className="text-2xl font-mono font-extrabold text-amber-600 tracking-tight">
                                        {formatCurrency(dailyFoodStats.costPerMealEstimate, 'ALL')}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        average cost assuming 3 meals a day
                                    </p>
                                </div>
                                <div className="text-[11px] font-mono text-slate-400 text-right">
                                    {formatCurrency(dailyFoodStats.totalFoodSpend, 'ALL')}
                                    <br />
                                    across {dailyFoodStats.daysElapsed} days
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500">
                                Start a budget cycle or log some Food expenses to see your daily burn rate.
                            </p>
                        )}
                    </div>
                </Card>
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
                                <Metric
                                    label="Total"
                                    value={formatCurrency(filteredAgg.total, 'ALL')}
                                />
                                <Metric label="Entries" value={String(filteredAgg.count)} />
                                <Metric
                                    label="Average"
                                    value={formatCurrency(filteredAgg.average, 'ALL')}
                                />
                                <Metric
                                    label="Per meal"
                                    value={
                                        filteredAgg.costPerMeal !== null
                                            ? formatCurrency(filteredAgg.costPerMeal, 'ALL')
                                            : '—'
                                    }
                                />
                            </div>
                        )}
                    </div>
                </Card>
                <p className="text-[10px] text-slate-400 px-1 mt-2">
                    Totals use each expense's value converted to Lek.
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