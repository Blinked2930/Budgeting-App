// src/hooks/useCurrency.ts
import { useState, useEffect } from 'react';
import type { Currency, ExchangeRates } from '../types';
import { DEFAULT_EXCHANGE_RATES } from '../types';
import { formatCurrency as baseFormat } from '../utils/currency';

export function useCurrency() {
    const [currency, setCurrency] = useState<Currency>(() => {
        const saved = localStorage.getItem('pulse:currency');
        return (saved as Currency) || 'ALL';
    });
    
    const [rates, setRates] = useState<ExchangeRates>(() => {
        const saved = localStorage.getItem('pulse:rates');
        return saved ? JSON.parse(saved) : DEFAULT_EXCHANGE_RATES;
    });

    useEffect(() => {
        const handleChange = () => {
            const savedCurrency = localStorage.getItem('pulse:currency');
            const savedRates = localStorage.getItem('pulse:rates');
            if (savedCurrency) setCurrency(savedCurrency as Currency);
            if (savedRates) setRates(JSON.parse(savedRates));
        };
        window.addEventListener('pulse:currency-changed', handleChange);
        return () => window.removeEventListener('pulse:currency-changed', handleChange);
    }, []);

    const format = (amountInALL: number) => {
        // Convert the amount from ALL to the target currency
        let converted = amountInALL;
        if (currency === 'EUR') {
            converted = amountInALL / rates.EUR;
        } else if (currency === 'USD') {
            converted = amountInALL / rates.USD;
        }
        
        // Format with the correct symbol
        return baseFormat(converted, currency);
    };

    return { currency, format, rates };
}