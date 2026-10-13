import React, { useState } from 'react';
import {
    CalendarDays,
    Landmark,
    Pencil,
    PiggyBank,
    RefreshCw,
    Wallet,
} from 'lucide-react';
import type { BudgetCycle } from '../types';
import { saveBudgetCycle, addExpense } from '../db';
import { useBudgetCycle } from '../hooks/useBudgetCycle';
import { addDays, toDateInputValue } from '../utils/budget';
import { formatCurrency } from '../utils/currency';
import { cn } from '../utils/cn';

type FormMode = 'first' | 'next' | 'edit';

interface FormValues {
    stipend: string;
    startDate: string;
    endDate: string;
    startingBalance: string;
    extraCash: string;
    travelStash: string;
}

const inputClass =
    'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/70';

const Field: React.FC<{
    label: string;
    hint?: string;
    children: React.ReactNode;
}> = ({ label, hint, children }) => (
    <label className="block space-y-1">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {label}
        </span>
        {children}
        {hint && <span className="block text-[10px] text-slate-600">{hint}</span>}
    </label>
);

interface CycleFormProps {
    title: string;
    submitLabel: string;
    notice?: string;
    initial: FormValues;
    mustStartAfter?: string;
    onSubmit: (values: Omit<BudgetCycle, 'id'>) => Promise<void>;
    onCancel?: () => void;
}

const CycleForm: React.FC<CycleFormProps> = ({
    title,
    submitLabel,
    notice,
    initial,
    mustStartAfter,
    onSubmit,
    onCancel,
}) => {
    const [values, setValues] = useState<FormValues>(initial);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const update = (key: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setValues((prev) => ({ ...prev, [key]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const stipend = parseFloat(values.stipend);
        if (!stipend || stipend <= 0) {
            setError('Enter your stipend amount.');
            return;
        }
        if (!values.startDate || !values.endDate) {
            setError('Pick both a start date and a next payday date.');
            return;
        }
        if (values.endDate <= values.startDate) {
            setError('The next payday must be after the start date.');
            return;
        }
        if (mustStartAfter && values.startDate <= mustStartAfter) {
            setError('The new cycle must start after the current one started.');
            return;
        }

        try {
            setIsSaving(true);
            await onSubmit({
                startDate: values.startDate,
                targetEndDate: values.endDate,
                stipendAmountALL: stipend,
                startingRaiffeisenBalanceALL: parseFloat(values.startingBalance) || 0,
                bufferPoolALL: parseFloat(values.extraCash) || 0,
                travelStashALL: parseFloat(values.travelStash) || 0,
            });
        } catch (err) {
            console.error('Failed to save budget cycle:', err);
            setError('Could not save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 shadow-2xl space-y-4"
        >
            <h2 className="text-base font-bold text-white">{title}</h2>

            {notice && (
                <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
                    {notice}
                </p>
            )}

            <Field label="Stipend (L)">
                <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={values.stipend}
                    onChange={update('stipend')}
                    placeholder="0"
                    className={inputClass}
                />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Cycle start">
                    <input
                        type="date"
                        value={values.startDate}
                        onChange={update('startDate')}
                        className={inputClass}
                    />
                </Field>
                <Field label="Next payday">
                    <input
                        type="date"
                        value={values.endDate}
                        onChange={update('endDate')}
                        className={inputClass}
                    />
                </Field>
            </div>

            <Field
                label="Initial cash (Raiffeisen)"
                hint="Your bank balance when this cycle starts, before the stipend."
            >
                <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={values.startingBalance}
                    onChange={update('startingBalance')}
                    placeholder="0"
                    className={inputClass}
                />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Budget Additions" hint="Optional initial extra cash block.">
                    <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={values.extraCash}
                        onChange={update('extraCash')}
                        placeholder="0"
                        className={inputClass}
                    />
                </Field>
                <Field label="Travel stash (L)" hint="Balance at cycle start.">
                    <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={values.travelStash}
                        onChange={update('travelStash')}
                        placeholder="0"
                        className={inputClass}
                    />
                </Field>
            </div>

            {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

            <div className="space-y-2 pt-1">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-60"
                >
                    {submitLabel}
                </button>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-full py-2.5 rounded-2xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-950 border border-slate-800 cursor-pointer"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
};

const StatTile: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
    negative?: boolean;
}> = ({ icon, label, value, sub, negative }) => (
    <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {icon}
            <span>{label}</span>
        </div>
        <p
            className={cn(
                'mt-1.5 text-lg font-mono font-bold tracking-tight',
                negative ? 'text-rose-400' : 'text-white'
            )}
        >
            {value}
        </p>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
);

export const BudgetView: React.FC = () => {
    const { cycle, stats, isLoading } = useBudgetCycle();
    const [formMode, setFormMode] = useState<FormMode | null>(null);
    const [adjAmount, setAdjAmount] = useState('');
    const [isAdjusting, setIsAdjusting] = useState(false);

    if (isLoading) {
        return <div className="w-full max-w-md mx-auto px-4 py-10 text-center text-xs text-slate-500">Loading…</div>;
    }

    const today = new Date();

    const saveCycle = (mode: FormMode) => async (values: Omit<BudgetCycle, 'id'>) => {
        const id = mode === 'edit' && cycle ? cycle.id : crypto.randomUUID();
        await saveBudgetCycle({ id, ...values });
        setFormMode(null);
    };

    const handleQuickAdjustment = async (type: 'add' | 'sub') => {
        const val = parseFloat(adjAmount);
        if (!val || val <= 0) return;
        setIsAdjusting(true);
        await addExpense({
            amount: type === 'add' ? -val : val,
            currency: 'ALL',
            category: 'Other',
            itemName: type === 'add' ? 'Budget Addition' : 'Budget Subtraction',
        });
        setAdjAmount('');
        setIsAdjusting(false);
    };

    if (!cycle || !stats) {
        return (
            <div className="w-full max-w-md mx-auto px-4 py-4">
                <CycleForm
                    key="first"
                    title="Set up your first cycle"
                    submitLabel="Start tracking"
                    notice="A cycle runs from one stipend to the next. LekFlow splits your budget across the days until payday."
                    initial={{
                        stipend: '',
                        startDate: toDateInputValue(today),
                        endDate: toDateInputValue(addDays(today, 30)),
                        startingBalance: '',
                        extraCash: '0',
                        travelStash: '0',
                    }}
                    onSubmit={saveCycle('first')}
                />
            </div>
        );
    }

    if (formMode === 'edit') {
        return (
            <div className="w-full max-w-md mx-auto px-4 py-4">
                <CycleForm
                    key="edit"
                    title="Edit cycle"
                    submitLabel="Save changes"
                    initial={{
                        stipend: String(cycle.stipendAmountALL),
                        startDate: cycle.startDate,
                        endDate: cycle.targetEndDate,
                        startingBalance: String(cycle.startingRaiffeisenBalanceALL),
                        extraCash: String(cycle.bufferPoolALL),
                        travelStash: String(cycle.travelStashALL),
                    }}
                    onSubmit={saveCycle('edit')}
                    onCancel={() => setFormMode(null)}
                />
            </div>
        );
    }

    if (formMode === 'next') {
        const newStash = Math.round(stats.travelStashBalance + stats.projectedSurplus);
        return (
            <div className="w-full max-w-md mx-auto px-4 py-4">
                <CycleForm
                    key="next"
                    title="Start next cycle"
                    submitLabel="Start new cycle"
                    notice={
                        stats.projectedSurplus > 0
                            ? `${formatCurrency(stats.projectedSurplus, 'ALL')} left over from this cycle moves into your travel stash.`
                            : 'No surplus this cycle, so nothing moves into your travel stash.'
                    }
                    mustStartAfter={cycle.startDate}
                    initial={{
                        stipend: String(cycle.stipendAmountALL),
                        startDate: toDateInputValue(today),
                        endDate: toDateInputValue(addDays(today, 30)),
                        startingBalance: String(Math.round(stats.estimatedBankBalance)),
                        extraCash: '0',
                        travelStash: String(newStash),
                    }}
                    onSubmit={saveCycle('next')}
                    onCancel={() => setFormMode(null)}
                />
            </div>
        );
    }

    const barColor =
        stats.percentSpent >= 90
            ? 'bg-rose-500'
            : stats.percentSpent >= 70
                ? 'bg-amber-400'
                : 'bg-emerald-400';

    return (
        <div className="w-full max-w-md mx-auto px-4 py-4 space-y-4">
            {stats.isPaydayReached && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3">
                    <span className="font-medium">Payday date reached. Ready for the next cycle?</span>
                    <button
                        type="button"
                        onClick={() => setFormMode('next')}
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-bold cursor-pointer"
                    >
                        Start
                    </button>
                </div>
            )}

            <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-900/80 border border-slate-800 shadow-xl">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Left to spend today
                </p>
                <p
                    className={cn(
                        'mt-1 text-4xl font-mono font-extrabold tracking-tight',
                        stats.leftToday < 0 ? 'text-rose-400' : 'text-emerald-300'
                    )}
                >
                    {formatCurrency(stats.leftToday, 'ALL')}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                    of {formatCurrency(stats.dailyAllowance, 'ALL')} today ·{' '}
                    {formatCurrency(stats.spentToday, 'ALL')} spent
                </p>

                <div className="mt-4">
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all', barColor)}
                            style={{ width: `${stats.percentSpent}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px] font-mono text-slate-500">
                        <span>{formatCurrency(stats.spent, 'ALL')} spent</span>
                        <span>{formatCurrency(stats.cycleBudget, 'ALL')} budget</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <StatTile
                    icon={<Wallet className="w-3.5 h-3.5 text-emerald-400" />}
                    label="Remaining"
                    value={formatCurrency(stats.remaining, 'ALL')}
                    sub="this cycle"
                    negative={stats.remaining < 0}
                />
                <StatTile
                    icon={<CalendarDays className="w-3.5 h-3.5 text-cyan-400" />}
                    label="To payday"
                    value={
                        stats.isPaydayReached
                            ? 'Today'
                            : `${stats.daysLeft} day${stats.daysLeft === 1 ? '' : 's'}`
                    }
                    sub={`day ${stats.dayNumber} of ${stats.totalDays}`}
                />
                <StatTile
                    icon={<RefreshCw className="w-3.5 h-3.5 text-amber-400" />}
                    label="Buffer pool"
                    value={formatCurrency(stats.bufferPool, 'ALL')}
                    sub="unspent from earlier days"
                />
                <StatTile
                    icon={<PiggyBank className="w-3.5 h-3.5 text-rose-400" />}
                    label="Travel stash"
                    value={formatCurrency(stats.travelStashBalance, 'ALL')}
                    sub={
                        stats.projectedSurplus > 0
                            ? `+${formatCurrency(stats.projectedSurplus, 'ALL')} at payday`
                            : undefined
                    }
                    negative={stats.travelStashBalance < 0}
                />
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <Landmark className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Estimated Raiffeisen balance
                        </p>
                        <p className="text-[10px] text-slate-600">start + stipend − tracked expenses</p>
                    </div>
                </div>
                <p
                    className={cn(
                        'text-base font-mono font-bold shrink-0',
                        stats.estimatedBankBalance < 0 ? 'text-rose-400' : 'text-white'
                    )}
                >
                    {formatCurrency(stats.estimatedBankBalance, 'ALL')}
                </p>
            </div>

            {stats.travelSpent > 0 && (
                <p className="text-[11px] text-slate-500 px-1">
                    {formatCurrency(stats.travelSpent, 'ALL')} of Travel spending is paid from the stash,
                    not the daily budget.
                </p>
            )}

            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => setFormMode('edit')}
                    className="py-3 rounded-2xl bg-slate-950 hover:bg-slate-800/70 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit cycle
                </button>
                <button
                    type="button"
                    onClick={() => setFormMode('next')}
                    className="py-3 rounded-2xl bg-slate-950 hover:bg-slate-800/70 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Next cycle
                </button>
            </div>

            {/* Quick Ledger Adjustments Tool */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3 mt-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Ledger Adjustment
                </p>
                <p className="text-[10px] text-slate-500">
                    Log additions (like refunds) or subtractions line-by-line without needing to edit your full cycle stats.
                </p>
                <div className="flex gap-2">
                    <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={adjAmount}
                        onChange={(e) => setAdjAmount(e.target.value)}
                        placeholder="Amount (Lek)"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/70"
                    />
                    <button
                        disabled={isAdjusting || !adjAmount}
                        onClick={() => handleQuickAdjustment('add')}
                        className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        + Add
                    </button>
                    <button
                        disabled={isAdjusting || !adjAmount}
                        onClick={() => handleQuickAdjustment('sub')}
                        className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        - Sub
                    </button>
                </div>
            </div>
        </div>
    );
};