// src/components/InsightsView.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Landmark,
    ListFilter,
    Store,
    TriangleAlert,
    CircleCheck,
    Utensils,
    Check,
    Banknote,
    CreditCard,
    HandCoins,
    ArrowUpRight,
    ArrowDownLeft,
    X,
    Trash2,
    PieChart,
    History,
    TrendingUp,
    PiggyBank,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CATEGORIES, type Category, type ExpenseRecord, type PaymentSource, type DebtRecord } from '../types';
import { useExpenses } from '../hooks/useExpenses';
import { useBudgetCycle } from '../hooks/useBudgetCycle';
import { useDebts } from '../hooks/useDebts';
import { db, addExpense, settleDebtCash, settleDebtNonCash, writeOffDebt, deleteDebt } from '../db';
import {
    DEFAULT_FILTERS,
    aggregate,
    aggregateByCategory,
    aggregateByVendor,
    aggregatePaidWith,
    filterExpenses,
    getMonthOptions,
    monthLabel,
    type InsightFilters,
} from '../utils/insights';
import { formatCurrency } from '../utils/currency';
import { cn } from '../utils/cn';

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

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={cn('p-4 rounded-2xl bg-white border border-slate-200 shadow-sm', className)}>
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
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">LekFlow expects</p>
                <p className="text-base font-mono font-bold text-slate-900">{formatCurrency(estimated, 'ALL')}</p>
            </div>
            <input
                type="number"
                inputMode="decimal"
                step="any"
                value={actualStr}
                onChange={(e) => setActualStr(e.target.value)}
                onBlur={handleBlur}
                placeholder="Actual"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />

            {hasActual && matches && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5">
                    <CircleCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Matches</span>
                </div>
            )}

            {hasActual && !matches && (
                <div className="flex flex-col gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
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
                        className="bg-amber-100 hover:bg-amber-200 text-amber-800 py-1 px-2 rounded-lg font-bold transition-colors text-center cursor-pointer text-[10px]"
                    >
                        Log {formatCurrency(Math.abs(amountToLog), 'ALL')}
                    </button>
                </div>
            )}

            {showDialog && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
                    onClick={() => {
                        dismissedValueRef.current = actualStr;
                        setShowDialog(false);
                    }}
                >
                    <div
                        className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-5 shadow-xl space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                                <TriangleAlert className="w-5 h-5 text-amber-500" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-base font-bold text-slate-900">Log a {label} discrepancy?</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    LekFlow expects {formatCurrency(estimated, 'ALL')} in {label.toLowerCase()}, but you entered {formatCurrency(actual, 'ALL')}.
                                </p>
                            </div>
                        </div>

                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Adjustment</p>
                            <p className={cn('text-lg font-mono font-bold mt-0.5', amountToLog > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                {amountToLog > 0 ? '−' : '+'}
                                {formatCurrency(Math.abs(amountToLog), 'ALL')}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1">Logs as a {paidWith.toLowerCase()} entry.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    dismissedValueRef.current = actualStr;
                                    setShowDialog(false);
                                }}
                                className="py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer hover:bg-slate-50"
                            >
                                Not now
                            </button>
                            <button
                                type="button"
                                onClick={handleReconcile}
                                disabled={isReconciling}
                                className="py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 hover:bg-emerald-700"
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
                <p className="text-xs text-slate-500">Set up a budget cycle in the Budget tab to see your estimated balances.</p>
            </Card>
        );
    }

    return (
        <Card className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <ReconcileRow icon={<Landmark className="w-3 h-3" />} label="Bank" estimated={stats.estimatedBankBalance} paidWith="Card" />
                <ReconcileRow icon={<Banknote className="w-3 h-3" />} label="Cash" estimated={stats.estimatedCashBalance} paidWith="Cash" />
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Net worth (with debts)</p>
                <p className={cn('text-base font-mono font-bold', stats.netWorthALL < 0 ? 'text-rose-600' : 'text-slate-900')}>
                    {formatCurrency(stats.netWorthALL, 'ALL')}
                </p>
            </div>
        </Card>
    );
};

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

const DebtRowActions: React.FC<{ debt: DebtRecord }> = ({ debt }) => {
    const [busy, setBusy] = useState<string | null>(null);
    const [amountStr, setAmountStr] = useState<string>(String(debt.remainingALL));

    useEffect(() => {
        setAmountStr(String(debt.remainingALL));
    }, [debt.remainingALL]);

    const owedToMe = debt.direction === 'OwedToMe';
    const parsed = parseFloat(amountStr);
    const requested = Number.isNaN(parsed) ? debt.remainingALL : parsed;
    const clamped = Math.min(Math.max(requested, 0), debt.remainingALL);
    const isPartial = clamped > 0 && clamped < debt.remainingALL;
    const isValid = clamped > 0;

    const handleCash = async (paidWith: PaymentSource) => {
        if (!isValid) return;
        setBusy('cash-' + paidWith);
        await settleDebtCash(debt.id, clamped, paidWith);
        setBusy(null);
    };

    const handleNonCash = async (paidWith: PaymentSource) => {
        if (!isValid) return;
        setBusy('noncash-' + paidWith);
        await settleDebtNonCash(debt.id, clamped, paidWith);
        setBusy(null);
    };

    const handleWriteOff = async () => {
        setBusy('writeoff');
        await writeOffDebt(debt.id);
        setBusy(null);
    };

    const handleDelete = async () => {
        setBusy('delete');
        await deleteDebt(debt.id);
        setBusy(null);
    };

    return (
        <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Amount to settle
                </p>
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={busy !== null}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                    title="Delete debt (undoes cash/bank effect)"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        placeholder="0"
                        className="w-full min-w-0 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    {isPartial ? (
                        <span className="text-[10px] font-semibold text-amber-600">
                            Partial · {formatCurrency(clamped, 'ALL')}
                        </span>
                    ) : (
                        <span className="text-[10px] font-semibold text-emerald-600">Full</span>
                    )}
                    {requested !== debt.remainingALL && (
                        <button
                            type="button"
                            onClick={() => setAmountStr(String(debt.remainingALL))}
                            className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {owedToMe ? (
                <div className="grid grid-cols-2 gap-1.5">
                    <button
                        type="button"
                        onClick={() => handleCash('Cash')}
                        disabled={busy !== null || !isValid}
                        className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-teal-200"
                    >
                        <Banknote className="w-3 h-3" />
                        Got cash
                    </button>
                    <button
                        type="button"
                        onClick={() => handleCash('Card')}
                        disabled={busy !== null || !isValid}
                        className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-rose-200"
                    >
                        <CreditCard className="w-3 h-3" />
                        Got bank
                    </button>
                    <button
                        type="button"
                        onClick={() => handleNonCash('Cash')}
                        disabled={busy !== null || !isValid}
                        className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-slate-200"
                    >
                        They offset
                    </button>
                    <button
                        type="button"
                        onClick={handleWriteOff}
                        disabled={busy !== null}
                        className="py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-amber-200"
                    >
                        Write off
                    </button>
                </div>
            ) : (
                <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleCash('Cash')}
                            disabled={busy !== null || !isValid}
                            className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-rose-200"
                        >
                            <Banknote className="w-3 h-3" />
                            Paid cash
                        </button>
                        <button
                            type="button"
                            onClick={() => handleCash('Card')}
                            disabled={busy !== null || !isValid}
                            className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-rose-200"
                        >
                            <CreditCard className="w-3 h-3" />
                            Paid bank
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleNonCash('Cash')}
                            disabled={busy !== null || !isValid}
                            className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-slate-200"
                        >
                            Offset cash
                        </button>
                        <button
                            type="button"
                            onClick={() => handleNonCash('Card')}
                            disabled={busy !== null || !isValid}
                            className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-slate-200"
                        >
                            Offset card
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleWriteOff}
                        disabled={busy !== null}
                        className="w-full py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold cursor-pointer disabled:opacity-50 border border-amber-200"
                    >
                        Forgiven
                    </button>
                </div>
            )}
        </div>
    );
};

const DebtDetailModal: React.FC<{
    counterpartyKey: string | null;
    onClose: () => void;
}> = ({ counterpartyKey, onClose }) => {
    const { debts } = useDebts();
    const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);

    const myDebts = useMemo(
        () => debts.filter((d) => d.counterpartyKey === counterpartyKey),
        [debts, counterpartyKey]
    );

    if (!counterpartyKey || myDebts.length === 0) return null;

    const name = myDebts[0].counterparty;
    const openDebts = myDebts.filter((d) => d.status === 'open');
    const resolvedDebts = myDebts.filter((d) => d.status === 'resolved');

    const handleDeleteResolved = async (id: string) => {
        setBusyDeleteId(id);
        await deleteDebt(id);
        setBusyDeleteId(null);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-3xl shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                            <HandCoins className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900">{name}</h3>
                            <p className="text-[10px] text-slate-500">
                                {openDebts.length} open · {resolvedDebts.length} resolved
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto p-4 space-y-3">
                    {openDebts.map((debt) => {
                        const owedToMe = debt.direction === 'OwedToMe';
                        return (
                            <div
                                key={debt.id}
                                className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                            >
                                <div className="flex items-center justify-between">
                                    <span
                                        className={cn(
                                            'text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1',
                                            owedToMe ? 'text-emerald-600' : 'text-rose-500'
                                        )}
                                    >
                                        {owedToMe ? (
                                            <ArrowUpRight className="w-3 h-3" />
                                        ) : (
                                            <ArrowDownLeft className="w-3 h-3" />
                                        )}
                                        {owedToMe ? 'Owes you' : 'You owe'}
                                    </span>
                                    <span className="text-sm font-mono font-bold text-slate-900">
                                        {formatCurrency(debt.remainingALL, 'ALL')}
                                    </span>
                                </div>

                                {debt.note && (
                                    <p className="text-[11px] text-slate-500 italic">{debt.note}</p>
                                )}

                                <p className="text-[10px] text-slate-400">
                                    {new Date(debt.createdAt).toLocaleDateString('en-GB', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                </p>

                                <DebtRowActions debt={debt} />
                            </div>
                        );
                    })}

                    {resolvedDebts.length > 0 && (
                        <>
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pt-2">
                                Resolved
                            </p>
                            {resolvedDebts.map((debt) => (
                                <div
                                    key={debt.id}
                                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                                >
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-slate-500 line-through truncate">
                                            {debt.direction === 'OwedToMe' ? 'Owes you' : 'You owe'}{' '}
                                            {formatCurrency(debt.amountALL, 'ALL')}
                                        </p>
                                        {debt.note && (
                                            <p className="text-[10px] text-slate-400 italic truncate line-through">
                                                {debt.note}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Check className="w-3.5 h-3.5 text-slate-400" />
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteResolved(debt.id)}
                                            disabled={busyDeleteId === debt.id}
                                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                                            title="Delete resolved debt (undoes all effects)"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const DebtsSection: React.FC = () => {
    const { openDebts } = useDebts();
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    const groups = useMemo(() => {
        const map = new Map<
            string,
            { key: string; name: string; receivables: number; payables: number; count: number }
        >();
        for (const d of openDebts) {
            let g = map.get(d.counterpartyKey);
            if (!g) {
                g = {
                    key: d.counterpartyKey,
                    name: d.counterparty,
                    receivables: 0,
                    payables: 0,
                    count: 0,
                };
                map.set(d.counterpartyKey, g);
            }
            if (d.direction === 'OwedToMe') g.receivables += d.remainingALL;
            else g.payables += d.remainingALL;
            g.count += 1;
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
                <p className="text-xs text-slate-500">
                    No open debts. Log a shared expense from Advanced Entry, or use Debts on the Log tab.
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
                            onClick={() => setSelectedKey(g.key)}
                            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-indigo-700">
                                        {g.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="min-w-0 text-left">
                                    <p className="text-xs font-semibold text-slate-900 truncate">
                                        {g.name}
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                        {g.count} {g.count === 1 ? 'item' : 'items'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                                <p
                                    className={cn(
                                        'text-sm font-mono font-bold',
                                        net > 0
                                            ? 'text-emerald-600'
                                            : net < 0
                                                ? 'text-rose-500'
                                                : 'text-slate-500'
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

            <DebtDetailModal
                counterpartyKey={selectedKey}
                onClose={() => setSelectedKey(null)}
            />
        </>
    );
};

const CycleHistorySection: React.FC = () => {
    // Fetch all non-deleted cycles sorted by newest first
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

    // Skip index 0 (that's the current active cycle)
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
    const [filters, setFilters] = useState<InsightFilters>(DEFAULT_FILTERS);

    const overall = useMemo(() => aggregate(expenses), [expenses]);
    const monthOptions = useMemo(() => getMonthOptions(expenses), [expenses]);
    const filtered = useMemo(() => filterExpenses(expenses, filters), [expenses, filters]);
    const filteredAgg = useMemo(() => aggregate(filtered), [filtered]);

    const update = (key: keyof InsightFilters) => (value: string) =>
        setFilters((prev) => ({ ...prev, [key]: value }));

    const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

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
                <Card>
                    {overall.costPerMeal !== null ? (
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-3xl font-mono font-extrabold text-emerald-600 tracking-tight">
                                    {formatCurrency(overall.costPerMeal, 'ALL')}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    average across all logged meals
                                </p>
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 text-right">
                                {formatCurrency(overall.mealSpend, 'ALL')}
                                <br />
                                for {overall.meals} meal{overall.meals === 1 ? '' : 's'}
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500">
                            Add an estimated meal count in Advanced Entry when you log food, and your
                            average cost per meal will show up here.
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