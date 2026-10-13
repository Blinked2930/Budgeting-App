import React, { useMemo, useState } from 'react';
import {
    Landmark,
    ListFilter,
    Store,
    TriangleAlert,
    CircleCheck,
    Utensils,
} from 'lucide-react';
import { FOOD_TYPES, VENDORS, type Currency } from '../types';
import { useExpenses } from '../hooks/useExpenses';
import { useBudgetCycle } from '../hooks/useBudgetCycle';
import {
    DEFAULT_FILTERS,
    aggregate,
    compareMarkets,
    filterExpenses,
    getMonthOptions,
    monthLabel,
    type InsightFilters,
} from '../utils/insights';
import { formatCurrency } from '../utils/currency';
import { cn } from '../utils/cn';

const CURRENCIES: Currency[] = ['ALL', 'EUR', 'USD'];

const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({
    icon,
    children,
}) => (
    <div className="flex items-center gap-1.5 px-1 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {icon}
        <h2>{children}</h2>
    </div>
);

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className,
}) => (
    <div className={cn('p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80', className)}>
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
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            {label}
        </p>
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
                                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
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
        <p className="mt-0.5 text-base font-mono font-bold text-white tracking-tight">{value}</p>
    </div>
);

const BankCheck: React.FC = () => {
    const { stats } = useBudgetCycle();
    const [actualStr, setActualStr] = useState('');

    if (!stats) {
        return (
            <Card>
                <p className="text-xs text-slate-400">
                    Set up a budget cycle in the Budget tab to get an estimated bank balance.
                </p>
            </Card>
        );
    }

    const actual = parseFloat(actualStr);
    const hasActual = !Number.isNaN(actual);
    const variance = hasActual ? actual - stats.estimatedBankBalance : 0;
    const matches = hasActual && Math.abs(variance) < 1;

    return (
        <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        LekFlow expects
                    </p>
                    <p className="text-xl font-mono font-bold text-white">
                        {formatCurrency(stats.estimatedBankBalance, 'ALL')}
                    </p>
                </div>
                <div className="w-36">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Actual balance (L)
                    </p>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={actualStr}
                        onChange={(e) => setActualStr(e.target.value)}
                        placeholder="Check your app"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/70"
                    />
                </div>
            </div>

            {hasActual && matches && (
                <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
                    <CircleCheck className="w-4 h-4 shrink-0" />
                    <span>Your bank balance matches your tracked expenses.</span>
                </div>
            )}

            {hasActual && !matches && (
                <div className="flex items-start gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-xl px-3 py-2">
                    <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                        {variance < 0
                            ? `Your bank has ${formatCurrency(Math.abs(variance), 'ALL')} less than expected. Some spending may not be logged.`
                            : `Your bank has ${formatCurrency(variance, 'ALL')} more than expected. This could be unlogged income, a refund, or an expense logged twice.`}
                    </span>
                </div>
            )}
        </Card>
    );
};

export const InsightsView: React.FC = () => {
    const { expenses } = useExpenses();
    const [filters, setFilters] = useState<InsightFilters>(DEFAULT_FILTERS);

    const overall = useMemo(() => aggregate(expenses), [expenses]);
    const markets = useMemo(() => compareMarkets(expenses), [expenses]);
    const monthOptions = useMemo(() => getMonthOptions(expenses), [expenses]);
    const filtered = useMemo(() => filterExpenses(expenses, filters), [expenses, filters]);
    const filteredAgg = useMemo(() => aggregate(filtered), [filtered]);

    const update = (key: keyof InsightFilters) => (value: string) =>
        setFilters((prev) => ({ ...prev, [key]: value }));

    const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

    const pazarShare =
        markets.pazar.total + markets.store.total > 0
            ? (markets.pazar.total / (markets.pazar.total + markets.store.total)) * 100
            : 0;

    let marketVerdict: string;
    if (markets.pazarCheaperByPct !== null) {
        const pct = Math.round(Math.abs(markets.pazarCheaperByPct));
        marketVerdict =
            markets.pazarCheaperByPct >= 0
                ? `Pazar meals cost about ${pct}% less per meal than the supermarket.`
                : `Supermarket meals cost about ${pct}% less per meal than the Pazar.`;
    } else if (markets.pazar.count === 0 || markets.store.count === 0) {
        marketVerdict = 'Log purchases from both Pazar and Supermarket to compare them.';
    } else {
        marketVerdict = 'Add estimated meals in Advanced Entry to compare cost per meal.';
    }

    return (
        <div className="w-full max-w-md mx-auto px-4 py-4 space-y-6">
            {/* Bank check */}
            <section>
                <SectionTitle icon={<Landmark className="w-3.5 h-3.5 text-slate-400" />}>
                    Raiffeisen check
                </SectionTitle>
                <BankCheck />
            </section>

            {/* Pazar vs Store */}
            <section>
                <SectionTitle icon={<Store className="w-3.5 h-3.5 text-slate-400" />}>
                    Pazar vs. supermarket
                </SectionTitle>
                <Card className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-emerald-300">Pazar</p>
                            <Metric label="Spent" value={formatCurrency(markets.pazar.total, 'ALL')} />
                            <Metric label="Entries" value={String(markets.pazar.count)} />
                            <Metric
                                label="Per meal"
                                value={
                                    markets.pazar.costPerMeal !== null
                                        ? formatCurrency(markets.pazar.costPerMeal, 'ALL')
                                        : '—'
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-cyan-300">Supermarket</p>
                            <Metric label="Spent" value={formatCurrency(markets.store.total, 'ALL')} />
                            <Metric label="Entries" value={String(markets.store.count)} />
                            <Metric
                                label="Per meal"
                                value={
                                    markets.store.costPerMeal !== null
                                        ? formatCurrency(markets.store.costPerMeal, 'ALL')
                                        : '—'
                                }
                            />
                        </div>
                    </div>

                    {markets.pazar.total + markets.store.total > 0 && (
                        <div className="h-2 rounded-full bg-cyan-400/70 overflow-hidden">
                            <div className="h-full bg-emerald-400" style={{ width: `${pazarShare}%` }} />
                        </div>
                    )}

                    <p className="text-xs text-slate-300">{marketVerdict}</p>
                </Card>
            </section>

            {/* Cost per meal */}
            <section>
                <SectionTitle icon={<Utensils className="w-3.5 h-3.5 text-slate-400" />}>
                    Cost per meal
                </SectionTitle>
                <Card>
                    {overall.costPerMeal !== null ? (
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-3xl font-mono font-extrabold text-emerald-300 tracking-tight">
                                    {formatCurrency(overall.costPerMeal, 'ALL')}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1">average across all logged meals</p>
                            </div>
                            <p className="text-[11px] font-mono text-slate-500 text-right">
                                {formatCurrency(overall.mealSpend, 'ALL')}
                                <br />
                                for {overall.meals} meal{overall.meals === 1 ? '' : 's'}
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400">
                            Add an estimated meal count in Advanced Entry when you log food, and your average
                            cost per meal will show up here.
                        </p>
                    )}
                </Card>
            </section>

            {/* Explorer */}
            <section>
                <SectionTitle icon={<ListFilter className="w-3.5 h-3.5 text-slate-400" />}>
                    Explore your data
                </SectionTitle>
                <Card className="space-y-4">
                    <ChipRow
                        label="Vendor"
                        options={VENDORS.map((v) => ({ value: v, label: v }))}
                        selected={filters.vendor}
                        onSelect={update('vendor')}
                    />
                    <ChipRow
                        label="Food type"
                        options={FOOD_TYPES.map((f) => ({ value: f, label: f }))}
                        selected={filters.foodType}
                        onSelect={update('foodType')}
                    />
                    <ChipRow
                        label="Currency"
                        options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                        selected={filters.currency}
                        onSelect={update('currency')}
                    />
                    {monthOptions.length > 0 && (
                        <ChipRow
                            label="Month"
                            options={monthOptions.slice(0, 6).map((m) => ({ value: m, label: monthLabel(m) }))}
                            selected={filters.month}
                            onSelect={update('month')}
                        />
                    )}

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={() => setFilters(DEFAULT_FILTERS)}
                            className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                        >
                            Clear filters
                        </button>
                    )}

                    <div className="pt-3 border-t border-slate-800">
                        {filtered.length === 0 ? (
                            <p className="text-xs text-slate-500">No expenses match these filters.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <Metric label="Total" value={formatCurrency(filteredAgg.total, 'ALL')} />
                                <Metric label="Entries" value={String(filteredAgg.count)} />
                                <Metric label="Average" value={formatCurrency(filteredAgg.average, 'ALL')} />
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
                <p className="text-[10px] text-slate-600 px-1 mt-2">
                    Totals use each expense's value converted to Lek.
                </p>
            </section>
        </div>
    );
};