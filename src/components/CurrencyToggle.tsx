// src/components/CurrencyToggle.tsx
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
      {/* Currency icon button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer shadow-sm select-none',
          selected === 'ALL'
            ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-700'
        )}
        title="Change currency / fund (automatically defaults to Lekë)"
        aria-label="Select currency"
      >
        <Coins className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="font-mono font-bold text-xs">
          {currentConfig.symbol}
        </span>
        <span className="text-[11px] font-semibold text-slate-500">
          {selected === 'ALL' ? 'Lekë' : selected}
        </span>
        <ChevronDown
          className={cn(
            'w-3 h-3 text-slate-400 transition-transform duration-150',
            isOpen && 'rotate-180 text-emerald-600'
          )}
        />
      </button>

      {/* Floating Mini Menu */}
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-40 animate-fade-in text-left">
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Currency / Fund
            </span>
            <p className="text-[10px] text-slate-400">Auto-resets to Lekë</p>
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
                      ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center font-mono font-bold text-slate-800">
                      {curr.symbol}
                    </span>
                    <div>
                      <div className="text-xs">{curr.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {curr.note}
                      </div>
                    </div>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};