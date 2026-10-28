// src/components/BudgetView.tsx
import React, { useState, useRef, useMemo } from 'react';
import {
    CalendarDays,
    Landmark,
    Pencil,
    PiggyBank,
    RefreshCw,
    Wallet,
    Banknote,
    X,
    HandCoins,
    Info,
    TriangleAlert,
    CircleCheck,
    Check,
} from 'lucide-react';
import type { BudgetCycle, PaymentSource } from '../types';
import type { BudgetStats } from '../utils/budget';
import { addExpense, saveBudgetCycle } from '../db';
import { useBudgetCycle } from '../hooks/useBudgetCycle';
import { useDebts } from '../hooks/useDebts';
import { useCurrency } from '../hooks/useCurrency';
import { addDays, toDateInputValue } from '../utils/budget';
import { cn } from '../utils/cn';
import { DebtsPanel } from './DebtsPanel';

type FormMode = 'first' | 'next' | 'edit';

interface FormValues {
    stipend: string;
    startDate: string;
    endDate: string;
    startingBalance: string;
    startingCash: string;
    extraCash: string;
    travelStash: string;
    plannedBig: string;
}

const inputClass =
    'w-full min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors';

const dateInputClass =
    'block w-full min-w-0 max-w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors';

const Field: React.FC<{
    label: string;
    hint?: string;
    children: React.ReactNode;
}> = ({ label, hint, children }) => (
    <label className="block space-y-1 min-w-0">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {label}
        </span>
        {children}
        {hint && <span className="block text-[10px] text-slate-400 mt-1">{hint}</span>}
    </label>
);

const TravelStashModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    cycle: BudgetCycle;
    stats: BudgetStats;
}> = ({ isOpen, onClose, cycle, stats }) => {
    const [amountStr, setAmountStr] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { format } = useCurrency();

    if (!isOpen) return null;

    const amount = parseFloat(amountStr);
    const hasAmount = !Number.isNaN(amount) && amount > 0;

    const handleAdd = async () => {
        if (!hasAmount) return;
        setIsSaving(true);
        await saveBudgetCycle({
            ...cycle,
            travelStashALL: cycle.travelStashALL + amount,
            bufferPoolALL: cycle.bufferPoolALL - amount,
        });
        setAmountStr('');
        setIsSaving(false);
        onClose();
    };

    const handleWithdraw = async () => {
        if (!hasAmount) return;
        setIsSaving(true);
        await saveBudgetCycle({
            ...cycle,
            travelStashALL: cycle.travelStashALL - amount,
            bufferPoolALL: cycle.bufferPoolALL + amount,
        });
        setAmountStr('');
        setIsSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-5 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                            <PiggyBank className="w-4 h-4 text-rose-600" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Travel Stash</h3>
                            <p className="text-[10px] text-slate-500">Current: {format(stats.travelStashBalance)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-3">
                    <Field label="Amount to move (L)">
                        <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={amountStr}
                            onChange={(e) => setAmountStr(e.target.value)}
                            placeholder="0"
                            className={inputClass}
                        />
                    </Field>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                        Adding to your stash moves money out of your available daily budget. Withdrawing moves it back. Neither action affects your Raiffeisen or Cash balances — Travel expenses will still deduct from Raiffeisen as usual.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                            type="button"
                            onClick={handleWithdraw}
                            disabled={isSaving || !hasAmount}
                            className="py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer hover:bg-slate-50 disabled:opacity-50"
                        >
                            Withdraw
                        </button>
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={isSaving || !hasAmount}
                            className="py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold cursor-pointer hover:bg-emerald-700 disabled:opacity-50"
                        >
                            Add to Stash
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

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
    const { format } = useCurrency();

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
                <p className="text-base font-mono font-bold text-slate-900">{format(estimated)}</p>
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
                                ? `${format(Math.abs(variance))} less than expected.`
                                : `${format(variance)} more than expected.`}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowDialog(true)}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-800 py-1 px-2 rounded-lg font-bold transition-colors text-center cursor-pointer text-[10px]"
                    >
                        Log {format(Math.abs(amountToLog))}
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
                                    LekFlow expects {format(estimated)} in {label.toLowerCase()}, but you entered {format(actual)}.
                                </p>
                            </div>
                        </div>

                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Adjustment</p>
                            <p className={cn('text-lg font-mono font-bold mt-0.5', amountToLog > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                {amountToLog > 0 ? '−' : '+'}
                                {format(Math.abs(amountToLog))}
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
                startingCashALL: parseFloat(values.startingCash) || 0,
                bufferPoolALL: parseFloat(values.extraCash) || 0,
                travelStashALL: parseFloat(values.travelStash) || 0,
                plannedBigExpensesALL: parseFloat(values.plannedBig) || 0,
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
            className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 overflow-hidden"
        >
            <h2 className="text-base font-bold text-slate-900">{title}</h2>

            {notice && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
                <Field label="Cycle start">
                    <input
                        type="date"
                        value={values.startDate}
                        onChange={update('startDate')}
                        className={dateInputClass}
                    />
                </Field>
                <Field label="Next payday">
                    <input
                        type="date"
                        value={values.endDate}
                        onChange={update('endDate')}
                        className={dateInputClass}
                    />
                </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
                <Field label="Bank at start (L)" hint="Raiffeisen balance when cycle starts.">
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
                <Field label="Cash at start (L)" hint="Cash in your pocket when cycle starts.">
                    <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={values.startingCash}
                        onChange={update('startingCash')}
                        placeholder="0"
                        className={inputClass}
                    />
                </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
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

            <Field
                label="Planned big expenses (L)"
                hint="Rent, utilities, insurance — total for the whole cycle. Pre-budgeted so your daily allowance stays honest from day one."
            >
                <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={values.plannedBig}
                    onChange={update('plannedBig')}
                    placeholder="0"
                    className={inputClass}
                />
            </Field>

            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

            <div className="space-y-2 pt-1">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-3 rounded-2xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-60 shadow-sm"
                >
                    {submitLabel}
                </button>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-full py-2.5 rounded-2xl text-xs font-semibold text-slate-500 hover:text-slate-900 bg-slate-50 border border-slate-200 cursor-pointer transition-colors"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
};

const InfoModal: React.FC<{ title: string; description: string; onClose: () => void; }> = ({ title, description, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-xs bg-white border border-slate-200 rounded-3xl p-5 shadow-xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-base font-bold text-slate-900">{title}</h3><button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
            <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100">Got it</button>
        </div>
    </div>
);

const StatTile: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
    negative?: boolean;
    onClick?: () => void;
    showInfo?: boolean;
}> = ({ icon, label, value, sub, negative, onClick, showInfo }) => (
    <div onClick={onClick} className={cn('p-3 rounded-2xl bg-white border border-slate-200 shadow-sm min-w-0 relative', onClick && 'cursor-pointer hover:border-emerald-300 transition-colors')}>
        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <div className="flex items-center gap-1.5 truncate">{icon} <span className="truncate">{label}</span></div>
            {showInfo && <Info className="w-3 h-3 text-slate-400" />}
        </div>
        <p className={cn('text-base sm:text-lg font-mono font-bold tracking-tight truncate', negative ? 'text-rose-600' : 'text-slate-900')}>{value}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
);

export const BudgetView: React.FC = () => {
    const { cycle, stats, isLoading } = useBudgetCycle();
    const { openDebts } = useDebts();
    const { format } = useCurrency();

    const [formMode, setFormMode] = useState<FormMode | null>(null);
    const [isDebtsOpen, setIsDebtsOpen] = useState(false);
    const [isTravelStashOpen, setIsTravelStashOpen] = useState(false);
    const [infoModal, setInfoModal] = useState<{ title: string; description: string } | null>(null);

    const debtGroups = useMemo(() => {
        const map = new Map<string, { key: string; name: string; receivables: number; payables: number }>();
        for (const d of openDebts) {
            let g = map.get(d.counterpartyKey);
            if (!g) {
                g = { key: d.counterpartyKey, name: d.counterparty, receivables: 0, payables: 0 };
                map.set(d.counterpartyKey, g);
            }
            if (d.direction === 'OwedToMe') g.receivables += d.remainingALL;
            else g.payables += d.remainingALL;
        }
        return Array.from(map.values()).sort((a, b) => {
            const aTotal = a.receivables + a.payables;
            const bTotal = b.receivables + b.payables;
            return bTotal - aTotal;
        });
    }, [openDebts]);

    if (isLoading) return <div className="w-full max-w-md mx-auto px-4 py-10 text-center text-xs text-slate-500">Loading…</div>;

    const today = new Date();

    const saveCycle = (mode: FormMode) => async (values: Omit<BudgetCycle, 'id'>) => {
        const id = mode === 'edit' && cycle ? cycle.id : crypto.randomUUID();
        await saveBudgetCycle({ id, ...values });
        setFormMode(null);
    };

    if (!cycle || !stats) {
        return (
            <div className="w-full max-w-md mx-auto px-3 sm:px-4 py-4">
                <CycleForm
                    key="first"
                    title="Set up your first cycle"
                    submitLabel="Start tracking"
                    notice="A cycle runs from one stipend to the next. Track bank and cash balances separately."
                    initial={{
                        stipend: '',
                        startDate: toDateInputValue(today),
                        endDate: toDateInputValue(addDays(today, 30)),
                        startingBalance: '',
                        startingCash: '',
                        extraCash: '0',
                        travelStash: '0',
                        plannedBig: '0',
                    }}
                    onSubmit={saveCycle('first')}
                />
            </div>
        );
    }

    if (formMode === 'edit') {
        return (
            <div className="w-full max-w-md mx-auto px-3 sm:px-4 py-4">
                <CycleForm
                    key="edit"
                    title="Edit cycle"
                    submitLabel="Save changes"
                    initial={{
                        stipend: String(cycle.stipendAmountALL),
                        startDate: cycle.startDate,
                        endDate: cycle.targetEndDate,
                        startingBalance: String(cycle.startingRaiffeisenBalanceALL),
                        startingCash: String(cycle.startingCashALL ?? 0),
                        extraCash: String(cycle.bufferPoolALL),
                        travelStash: String(cycle.travelStashALL),
                        plannedBig: String(cycle.plannedBigExpensesALL ?? 0),
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
            <div className="w-full max-w-md mx-auto px-3 sm:px-4 py-4">
                <CycleForm
                    key="next"
                    title="Start next cycle"
                    submitLabel="Start new cycle"
                    notice={
                        stats.projectedSurplus > 0
                            ? `${format(stats.projectedSurplus)} left over from this cycle moves into your travel stash.`
                            : 'No surplus this cycle, so nothing moves into your travel stash.'
                    }
                    mustStartAfter={cycle.startDate}
                    initial={{
                        stipend: String(cycle.stipendAmountALL),
                        startDate: toDateInputValue(today),
                        endDate: toDateInputValue(addDays(today, 30)),
                        startingBalance: String(Math.round(stats.estimatedBankBalance)),
                        startingCash: String(Math.round(stats.estimatedCashBalance)),
                        extraCash: '0',
                        travelStash: String(newStash),
                        plannedBig: String(cycle.plannedBigExpensesALL ?? 0),
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
                ? 'bg-amber-500'
                : 'bg-emerald-500';

    const hasDebts = stats.receivablesALL > 0 || stats.payablesALL > 0;

    return (
        <div className="w-full max-w-md mx-auto px-3 sm:px-4 py-4 space-y-3.5">
            {infoModal && <InfoModal title={infoModal.title} description={infoModal.description} onClose={() => setInfoModal(null)} />}
            <DebtsPanel isOpen={isDebtsOpen} onClose={() => setIsDebtsOpen(false)} />
            <TravelStashModal isOpen={isTravelStashOpen} onClose={() => setIsTravelStashOpen(false)} cycle={cycle} stats={stats} />

            {stats.isPaydayReached && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-center justify-between gap-3 shadow-sm">
                    <span className="font-medium">Payday date reached. Ready for the next cycle?</span>
                    <button
                        type="button"
                        onClick={() => setFormMode('next')}
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold cursor-pointer hover:bg-amber-600 transition-colors shadow-sm"
                    >
                        Start
                    </button>
                </div>
            )}

            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Left to spend today
                    </p>
                    <button onClick={() => setInfoModal({ title: 'Left to Spend Today', description: 'Your daily allowance is capped at your total budget divided by the total cycle days. If you overspend, this number shrinks to help you stay on track. If you underspend, the extra money goes into your Buffer Pool and is saved for the end of the cycle rather than increasing your future daily allowance. Big expenses (like rent) are subtracted upfront so they do not spike or crash this number.' })}>
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                </div>
                <p
                    className={cn(
                        'mt-1 text-3xl sm:text-4xl font-mono font-extrabold tracking-tight leading-tight',
                        stats.leftToday < 0 ? 'text-rose-600' : 'text-emerald-600'
                    )}
                >
                    {format(stats.leftToday)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                    of {format(stats.dailyAllowance)} today ·{' '}
                    {format(stats.spentToday)} spent
                </p>

                <div className="mt-3.5">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all', barColor)}
                            style={{ width: `${stats.percentSpent}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px] font-mono text-slate-400">
                        <span>{format(stats.spent)} spent</span>
                        <span>{format(stats.cycleBudget)} budget</span>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <ReconcileRow icon={<Landmark className="w-3 h-3" />} label="Bank" estimated={stats.estimatedBankBalance} paidWith="Card" />
                    <ReconcileRow icon={<Banknote className="w-3 h-3" />} label="Cash" estimated={stats.estimatedCashBalance} paidWith="Cash" />
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Net worth (with debts)</p>
                    <p className={cn('text-base font-mono font-bold', stats.netWorthALL < 0 ? 'text-rose-600' : 'text-slate-900')}>
                        {format(stats.netWorthALL)}
                    </p>
                </div>
            </div>

            {hasDebts && (
                <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <HandCoins className="w-3.5 h-3.5 text-indigo-600" />
                            <p className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">Debts</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsDebtsOpen(true)}
                            className="text-[10px] text-indigo-500 hover:underline cursor-pointer"
                        >
                            Manage →
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Owed to you</p>
                            <p className="text-sm font-mono font-bold text-emerald-600">{format(stats.receivablesALL)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">You owe</p>
                            <p className="text-sm font-mono font-bold text-rose-600">{format(stats.payablesALL)}</p>
                        </div>
                    </div>

                    {debtGroups.length > 0 && (
                        <div className="pt-3 border-t border-slate-100 space-y-1.5">
                            {debtGroups.map((g) => {
                                const net = g.receivables - g.payables;
                                return (
                                    <button
                                        key={g.key}
                                        type="button"
                                        onClick={() => setIsDebtsOpen(true)}
                                        className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                                                <span className="text-[10px] font-bold text-indigo-700">{g.name.charAt(0).toUpperCase()}</span>
                                            </div>
                                            <p className="text-xs font-semibold text-slate-900 truncate">{g.name}</p>
                                        </div>
                                        <p className={cn('text-xs font-mono font-bold shrink-0', net > 0 ? 'text-emerald-600' : net < 0 ? 'text-rose-600' : 'text-slate-500')}>
                                            {net > 0 ? '+' : ''}{format(Math.abs(net))}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Net</p>
                        <p className={cn('text-sm font-mono font-bold', stats.netOfDebtsALL > 0 ? 'text-emerald-600' : stats.netOfDebtsALL < 0 ? 'text-rose-600' : 'text-slate-500')}>
                            {stats.netOfDebtsALL > 0 ? '+' : ''}
                            {format(Math.abs(stats.netOfDebtsALL))}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
                <StatTile
                    icon={<Wallet className="w-3.5 h-3.5 text-emerald-600" />}
                    label="Remaining"
                    value={format(stats.remaining)}
                    sub="this cycle"
                    negative={stats.remaining < 0}
                    showInfo
                    onClick={() => setInfoModal({ title: 'Remaining Budget', description: 'Your stipend minus your tracked expenses (only the portion that counts against your budget). This can be higher than Bank + Cash if you have money tied up in debts or travel stashes.' })}
                />
                <StatTile
                    icon={<CalendarDays className="w-3.5 h-3.5 text-cyan-600" />}
                    label="To payday"
                    value={stats.isPaydayReached ? 'Today' : `${stats.daysLeft} day${stats.daysLeft === 1 ? '' : 's'}`}
                    sub={`day ${stats.dayNumber} of ${stats.totalDays}`}
                    showInfo
                    onClick={() => setInfoModal({ title: 'Days Left', description: 'Days remaining until your target next payday. Used to calculate your daily allowance.' })}
                />
                <StatTile
                    icon={<RefreshCw className="w-3.5 h-3.5 text-amber-600" />}
                    label="Buffer pool"
                    value={format(stats.bufferPool)}
                    sub="unspent from logged days"
                    showInfo
                    onClick={() => setInfoModal({ title: 'Buffer Pool', description: 'Money you saved by spending less than the expected daily burn rate. This is automatically added to your budget for the next cycle (or rolls into your Travel Stash). It does not increase your daily allowance.' })}
                />
                <StatTile
                    icon={<PiggyBank className="w-3.5 h-3.5 text-rose-600" />}
                    label="Travel stash"
                    value={format(stats.travelStashBalance)}
                    sub={stats.projectedSurplus > 0 ? `+${format(stats.projectedSurplus)} at payday` : undefined}
                    negative={stats.travelStashBalance < 0}
                    onClick={() => setIsTravelStashOpen(true)}
                />
            </div>

            {stats.travelSpent > 0 && (
                <p className="text-[11px] text-slate-500 px-1">
                    {format(stats.travelSpent)} of Travel spending is paid from the stash, not the daily budget.
                </p>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                    type="button"
                    onClick={() => setFormMode('edit')}
                    className="py-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit cycle
                </button>
                <button
                    type="button"
                    onClick={() => setFormMode('next')}
                    className="py-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Next cycle
                </button>
            </div>
        </div>
    );
};