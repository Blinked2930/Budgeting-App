// src/components/InsightsView.tsx
import React, { useMemo, useRef, useState } from 'react';
import {
    Landmark,
    ListFilter,
    Store,
    TriangleAlert,
    CircleCheck,
    Utensils,
    Check,
    Banknote,
    HandCoins,
    ArrowUpRight,
    ArrowDownLeft,
    X,
} from 'lucide-react';
import { FOOD_TYPES, VENDORS, type Currency, type PaymentSource, type DebtRecord } from '../types';
import { useExpenses } from '../hooks/useExpenses';
import { useBudgetCycle } from '../hooks/useBudgetCycle';
import { useDebts } from '../hooks/useDebts';
import { addExpense, settleDebtCash, settleDebtNonCash, writeOffDebt } from '../db';
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

const ReconcileRow: React.FC<{
    icon: React.ReactNode;
    label: string;
    estimated: number;
    paidWith: PaymentSource;
}> = ({ icon, label, estimated, paidWith }) => {
    const [actualStr, setActualStr] = useState('');
    const [isReconciling, setIsReconciling] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const dismissedValueRef = useRef<string | null>(null);

    const actual = parseFloat(actualStr);
    const hasActual = actualStr.trim() !== '' && !Number.isNaN(actual);
    const variance = hasActual ? actual - estimated : 0;
    const matches = hasActual && Math.abs(variance) < 1;
    const amountToLog = hasActual ? estimated - actual : 0;
    const hasDiscrepancy = hasActual && !matches && Math.abs(amountToLog) >= 1;

    const handleReconcile = async () => {
        if (!hasDiscrepancy) return;
        setIsReconciling(true);
        await addExpense({
            amount: amountToLog,
            currency: 'ALL',
            category: 'Other',
            paidWith,
            itemName: 'Balance Reconciliation',
        });
        setActualStr('');
        setShowDialog(false);
        dismissedValueRef.current = null;
        setIsReconciling(false);
    };

    const handleBlur = () => {
        if (!hasDiscrepancy) return;
        if (dismissedValueRef.current === actualStr) return;
        setShowDialog(true);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {icon}
                <span>{label}</span>
            </div>
            <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    LekFlow expects
                </p>
                <p className="text-base font-mono font-bold text-white">
                    {formatCurrency(estimated, 'ALL')}
                </p>
            </div>
            <input
                type="number"
                inputMode="decimal"
                step="any"
                value={actualStr}
                onChange={(e) => setActualStr(e.target.value)}
                onBlur={handleBlur}
                placeholder="Actual"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/70"
            />

            {hasActual && matches && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-2.5 py-1.5">
                    <CircleCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Matches</span>
                </div>
            )}

            {hasActual && !matches && (
                <div className="flex flex-col gap-1.5 text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-xl px-2.5 py-1.5">
                    <div className="flex items-start gap-1.5">
                        <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                            {variance < 0
                                ? `${formatCurrency(Math.abs(variance), 'ALL')} less than expected.`
                                : `${formatCurrency(variance, 'ALL')} more than expected.`}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowDialog(true)}
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 py-1 px-2 rounded-lg font-bold transition-colors text-center cursor-pointer text-[10px]"
                    >
                        Log {formatCurrency(Math.abs(amountToLog), 'ALL')}
                    </button>
                </div>
            )}

            {showDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
                                <TriangleAlert className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-base font-bold text-white">
                                    Log a {label} discrepancy?
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    LekFlow expects {formatCurrency(estimated, 'ALL')} in {label.toLowerCase()}, but you entered {formatCurrency(actual, 'ALL')}.
                                </p>
                            </div>
                        </div>

                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                Adjustment
                            </p>
                            <p
                                className={cn(
                                    'text-lg font-mono font-bold mt-0.5',
                                    amountToLog > 0 ? 'text-rose-400' : 'text-emerald-400'
                                )}
                            >
                                {amountToLog > 0 ? '−' : '+'}
                                {formatCurrency(Math.abs(amountToLog), 'ALL')}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1">
                                Logs as a {paidWith.toLowerCase()} entry.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    dismissedValueRef.current = actualStr;
                                    setShowDialog(false);
                                }}
                                className="py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                            >
                                Not now
                            </button>
                            <button
                                type="button"
                                onClick={handleReconcile}
                                disabled={isReconciling}
                                className="py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                <Check className="w-3.5 h-3.5" />
                                {isReconciling ? 'Logging…' : 'Log it'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const BankCheck: React.FC = () => {
    const { stats } = useBudgetCycle();

    if (!stats) {
        return (
            <Card>
                <p className="text-xs text-slate-400">
                    Set up a budget cycle in the Budget tab to see your estimated balances.
                </p>
            </Card>
        );
    }

    return (
        <Card className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <ReconcileRow
                    icon={<Landmark className="w-3 h-3" />}
                    label="Bank"
                    estimated={stats.estimatedBankBalance}
                    paidWith="Card"
                />
                <ReconcileRow
                    icon={<Banknote className="w-3 h-3" />}
                    label="Cash"
                    estimated={stats.estimatedCashBalance}
                    paidWith="Cash"
                />
            </div>
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Net worth (with debts)
                </p>
                <p
                    className={cn(
                        'text-base font-mono font-bold',
                        stats.netWorthALL < 0 ? 'text-rose-400' : 'text-white'
                    )}
                >
                    {formatCurrency(stats.netWorthALL, 'ALL')}
                </p>
            </div>
        </Card>
    );
};

interface CounterpartyGroup {
    key: string;
    name: string;
    receivables: number;
    payables: number;
    debts: DebtRecord[];
}

const DebtDetailModal: React.FC<{
    group: CounterpartyGroup | null;
    onClose: () => void;
}> = ({ group, onClose }) => {
    const [busyId, setBusyId] = useState<string | null>(null);

    if (!group) return null;

    const handleSettleCash = async (debt: DebtRecord) => {
        setBusyId(debt.id);
        const paidWith: PaymentSource = 'Cash';
        await settleDebtCash(debt.id, debt.remainingALL, paidWith);
        setBusyId(null);
    };

    const handleSettleNonCash = async (debt: DebtRecord) => {
        setBusyId(debt.id);
        await settleDebtNonCash(debt.id, debt.remainingALL);
        setBusyId(null);
    };

    const handleWriteOff = async (debt: DebtRecord) => {
        setBusyId(debt.id);
        await writeOffDebt(debt.id);
        setBusyId(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md max-h-[85vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
                <div className="flex items-center justify-between p-5 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center">
                            <HandCoins className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">{group.name}</h3>
                            <p className="text-[10px] text-slate-500">
                                {group.debts.length} {group.debts.length === 1 ? 'debt' : 'debts'} open
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto p-4 space-y-3">
                    {group.debts.map((debt) => {
                        const owedToMe = debt.direction === 'OwedToMe';
                        const isBusy = busyId === debt.id;
                        return (
                            <div
                                key={debt.id}
                                className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2"
                            >
                                <div className="flex items-center justify-between">
                                    <span
                                        className={cn(
                                            'text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1',
                                            owedToMe ? 'text-emerald-400' : 'text-rose-400'
                                        )}
                                    >
                                        {owedToMe ? (
                                            <ArrowUpRight className="w-3 h-3" />
                                        ) : (
                                            <ArrowDownLeft className="w-3 h-3" />
                                        )}
                                        {owedToMe ? 'Owes you' : 'You owe'}
                                    </span>
                                    <span className="text-sm font-mono font-bold text-white">
                                        {formatCurrency(debt.remainingALL, 'ALL')}
                                    </span>
                                </div>

                                {debt.note && (
                                    <p className="text-[11px] text-slate-400 italic">
                                        {debt.note}
                                    </p>
                                )}

                                <p className="text-[10px] text-slate-600">
                                    {new Date(debt.createdAt).toLocaleDateString('en-GB', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                </p>

                                <div className="grid grid-cols-3 gap-1.5 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => handleSettleCash(debt)}
                                        disabled={isBusy}
                                        className="py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold cursor-pointer disabled:opacity-50"
                                        title={owedToMe ? 'They paid me in cash' : 'I paid them in cash'}
                                    >
                                        Cash settled
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSettleNonCash(debt)}
                                        disabled={isBusy}
                                        className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer disabled:opacity-50"
                                        title="Settle without cash (e.g. they bought you a drink)"
                                    >
                                        Non-cash
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleWriteOff(debt)}
                                        disabled={isBusy}
                                        className="py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold cursor-pointer disabled:opacity-50"
                                        title="Convert this to a gift you paid for"
                                    >
                                        Write off
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                    {group.receivables > 0 && (
                        <span className="text-emerald-400">
                            Owes you {formatCurrency(group.receivables, 'ALL')}
                        </span>
                    )}
                    {group.payables > 0 && (
                        <span className="text-rose-400">
                            You owe {formatCurrency(group.payables, 'ALL')}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const DebtsSection: React.FC = () => {
    const { openDebts } = useDebts();
    const [selected, setSelected] = useState<CounterpartyGroup | null>(null);

    const groups = useMemo<CounterpartyGroup[]>(() => {
        const map = new Map<string, CounterpartyGroup>();
        for (const d of openDebts) {
            let g = map.get(d.counterpartyKey);
            if (!g) {
                g = { key: d.counterpartyKey, name: d.counterparty, receivables: 0, payables: 0, debts: [] };
                map.set(d.counterpartyKey, g);
            }
            if (d.direction === 'OwedToMe') g.receivables += d.remainingALL;
            else g.payables += d.remainingALL;
            g.debts.push(d);
        }
        return Array.from(map.values()).sort((a, b) => {
            const aTotal = a.receivables + a.payables;
            const bTotal = b.receivables + b.payables;
            return bTotal - aTotal;
        });
    }, [openDebts]);

    if (groups.length === 0) {
        return (
            <Card>
                <p className="text-xs text-slate-400">
                    No open debts. Log a shared expense from Advanced Entry, or use Lend / Borrow on the Log tab.
                </p>
            </Card>
        );
    }

    return (
        <>
            <Card className="space-y-2">
                {groups.map((g) => {
                    const net = g.receivables - g.payables;
                    return (
                        <button
                            key={g.key}
                            type="button"
                            onClick={() => setSelected(g)}
                            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-purple-300">
                                        {g.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="min-w-0 text-left">
                                    <p className="text-xs font-semibold text-slate-200 truncate">
                                        {g.name}
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                        {g.debts.length} {g.debts.length === 1 ? 'item' : 'items'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                                <p
                                    className={cn(
                                        'text-sm font-mono font-bold',
                                        net > 0 ? 'text-emerald-400' : net < 0 ? 'text-rose-400' : 'text-slate-400'
                                    )}
                                >
                                    {net > 0 ? '+' : ''}
                                    {formatCurrency(Math.abs(net), 'ALL')}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                    {net > 0 ? 'owes you' : net < 0 ? 'you owe' : 'settled'}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </Card>

            <DebtDetailModal group={selected} onClose={() => setSelected(null)} />
        </>
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
            <section>
                <SectionTitle icon={<Landmark className="w-3.5 h-3.5 text-slate-400" />}>
                    Reconcile bank & cash
                </SectionTitle>
                <BankCheck />
            </section>

            <section>
                <SectionTitle icon={<HandCoins className="w-3.5 h-3.5 text-slate-400" />}>
                    Debts
                </SectionTitle>
                <DebtsSection />
            </section>

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