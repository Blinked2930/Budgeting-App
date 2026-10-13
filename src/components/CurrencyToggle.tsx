import React, { useState, useRef, useEffect } from 'react';
import { Coins, ChevronDown, Check } from 'lucide-react';
import type { Currency } from '../types';
import { DEFAULT_EXCHANGE_RATES } from '../types';
import { cn } from '../utils/cn';

interface CurrencyToggleProps {
  selected: Currency;
  onChange: (currency: Currency) => void;
  className?: string;
}

const CURRENCIES: { key: Currency; label: string; symbol: string; note: string }[] = [
  { key: 'ALL', label: 'Lekë (ALL)', symbol: 'L', note: 'Default currency' },
  { key: 'EUR', label: 'Euro (EUR)', symbol: '€', note: `1 EUR ≈ ${DEFAULT_EXCHANGE_RATES.EUR} ALL` },
  { key: 'USD', label: 'US Dollar (USD)', symbol: '$', note: `1 USD ≈ ${DEFAULT_EXCHANGE_RATES.USD} ALL` },
];

export const CurrencyToggle: React.FC<CurrencyToggleProps> = ({
  selected,
  onChange,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const currentConfig = CURRENCIES.find((c) => c.key === selected) || CURRENCIES[0];

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      {/* Little clickable currency icon button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer shadow-sm select-none',
          selected === 'ALL'
            ? 'bg-slate-800/90 hover:bg-slate-850 border-slate-700/70 text-slate-200 hover:border-slate-600'
            : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/50 text-emerald-300'
        )}
        title="Change currency / fund (automatically defaults to Lekë)"
        aria-label="Select currency"
      >
        <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="font-mono font-bold text-xs">
          {currentConfig.symbol}
        </span>
        <span className="text-[11px] font-semibold text-slate-400">
          {selected === 'ALL' ? 'Lekë' : selected}
        </span>
        <ChevronDown
          className={cn(
            'w-3 h-3 text-slate-400 transition-transform duration-150',
            isOpen && 'rotate-180 text-emerald-400'
          )}
        />
      </button>

      {/* Floating Mini Menu */}
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-1.5 z-40 animate-fade-in text-left">
          <div className="px-2.5 py-1.5 border-b border-slate-800 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Currency / Fund
            </span>
            <p className="text-[10px] text-slate-500">Auto-resets to Lekë</p>
          </div>

          <div className="space-y-1">
            {CURRENCIES.map((curr) => {
              const isActive = selected === curr.key;
              return (
                <button
                  key={curr.key}
                  type="button"
                  onClick={() => {
                    onChange(curr.key);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left',
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center font-mono font-bold text-slate-200">
                      {curr.symbol}
                    </span>
                    <div>
                      <div className="text-xs">{curr.label}</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        {curr.note}
                      </div>
                    </div>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
