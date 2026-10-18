// src/components/SettingsView.tsx
import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, FileJson, Lock, CheckCircle2, Trash2 } from 'lucide-react';
import { db, exportToCSV, exportToJSON } from '../db';
import { downloadFile } from '../utils/export';
import { useLock } from '../hooks/useLock';
import { DEFAULT_EXCHANGE_RATES } from '../types';

export const SettingsView: React.FC = () => {
    const { lock } = useLock();
    const [toast, setToast] = useState<string | null>(null);
    const [rates, setRates] = useState({ EUR: 100, USD: 90 });

    useEffect(() => {
        const saved = localStorage.getItem('lekflow:rates');
        if (saved) setRates(JSON.parse(saved));
        else setRates(DEFAULT_EXCHANGE_RATES);
    }, []);

    const saveRates = (newRates: typeof rates) => {
        setRates(newRates);
        localStorage.setItem('lekflow:rates', JSON.stringify(newRates));
        showToast('Exchange rates updated');
    };

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const handleExportCSV = async () => {
        const csv = await exportToCSV();
        const dateStr = new Date().toISOString().split('T')[0];
        downloadFile(csv, `lekflow-full-${dateStr}.csv`, 'text/csv;charset=utf-8;');
        showToast('CSV exported!');
    };

    const handleExportJSON = async () => {
        const json = await exportToJSON();
        const dateStr = new Date().toISOString().split('T')[0];
        downloadFile(json, `lekflow-full-${dateStr}.json`, 'application/json;charset=utf-8;');
        showToast('JSON backup exported!');
    };

    const handleWipe = async () => {
        if (!window.confirm('Are you absolutely sure? This will delete all local data. Make sure you exported first!')) return;
        await db.delete();
        window.location.reload();
    };

    return (
        <div className="w-full max-w-md mx-auto px-4 py-4 space-y-6">
            {toast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-4 h-4" /> {toast}
                </div>
            )}

            <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Settings</h2>
                <p className="text-xs text-slate-500">Manage your data, security, and preferences.</p>
            </div>

            <section className="space-y-2">
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">Data Portability</h3>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <button onClick={handleExportCSV} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 border-b border-slate-100 transition-colors cursor-pointer text-left">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Export CSV</p>
                            <p className="text-[11px] text-slate-500">Expenses, debts, transfers, cycles.</p>
                        </div>
                    </button>
                    <button onClick={handleExportJSON} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors cursor-pointer text-left">
                        <div className="w-8 h-8 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0">
                            <FileJson className="w-4 h-4 text-cyan-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Export JSON</p>
                            <p className="text-[11px] text-slate-500">Full raw data backup.</p>
                        </div>
                    </button>
                </div>
            </section>

            <section className="space-y-2">
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">Exchange Rates (Fallback)</h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">1 EUR =</span>
                        <div className="flex items-center gap-2">
                            <input type="number" value={rates.EUR} onChange={(e) => saveRates({ ...rates, EUR: Number(e.target.value) })} className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-right font-mono text-sm focus:outline-none focus:border-emerald-500" />
                            <span className="text-xs text-slate-500 font-mono">ALL</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">1 USD =</span>
                        <div className="flex items-center gap-2">
                            <input type="number" value={rates.USD} onChange={(e) => saveRates({ ...rates, USD: Number(e.target.value) })} className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-right font-mono text-sm focus:outline-none focus:border-emerald-500" />
                            <span className="text-xs text-slate-500 font-mono">ALL</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-2">
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">Security</h3>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <button onClick={lock} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors cursor-pointer text-left">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                            <Lock className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Lock App Now</p>
                            <p className="text-[11px] text-slate-500">Require PIN to re-enter.</p>
                        </div>
                    </button>
                </div>
            </section>

            <section className="space-y-2">
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">Danger Zone</h3>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <button onClick={handleWipe} className="w-full flex items-center gap-3 p-4 hover:bg-rose-50 transition-colors cursor-pointer text-left">
                        <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                            <Trash2 className="w-4 h-4 text-rose-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-rose-700">Reset Local Data</p>
                            <p className="text-[11px] text-rose-500">Wipe Dexie and start fresh.</p>
                        </div>
                    </button>
                </div>
            </section>
        </div>
    );
};