// src/components/BottomNav.tsx
import React from 'react';
import { ChartColumn, Wallet, Zap } from 'lucide-react';
import { cn } from '../utils/cn';

export type Tab = 'log' | 'budget' | 'insights';

interface BottomNavProps {
    active: Tab;
    onChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'log', label: 'Log', icon: <Zap className="w-6 h-6" /> },
    { id: 'budget', label: 'Budget', icon: <Wallet className="w-6 h-6" /> },
    { id: 'insights', label: 'Insights', icon: <ChartColumn className="w-6 h-6" /> },
];

export const BottomNav: React.FC<BottomNavProps> = ({ active, onChange }) => {
    return (
        <div
            className="fixed inset-x-0 z-20 mx-auto max-w-md px-4 pointer-events-none"
            style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
            <nav className="pointer-events-auto rounded-3xl border border-slate-800/80 bg-slate-950/90 backdrop-blur-md shadow-2xl shadow-black/50">
                <div className="grid grid-cols-3 px-2 py-1.5 gap-1">
                    {TABS.map((tab) => {
                        const isActive = tab.id === active;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => onChange(tab.id)}
                                className={cn(
                                    'flex flex-col items-center gap-0.5 py-2 rounded-2xl text-[11px] font-semibold leading-tight transition-colors cursor-pointer',
                                    isActive
                                        ? 'bg-emerald-500/15 text-emerald-300'
                                        : 'text-slate-500 hover:text-slate-300'
                                )}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};