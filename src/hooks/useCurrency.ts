// src/hooks/useCurrency.ts
import { useState, useEffect } from 'react';
import type { Currency } from '../types';
import { formatCurrency as baseFormat } from '../utils/currency';

export function useCurrency() {
    const [currency, setCurrency] = useState<Currency>(() => {
        const saved = localStorage.getItem('lekflow:currency');
        return (saved as Currency) || 'ALL';
    });

    useEffect(() => {
        const handleChange = () => {
            const saved = localStorage.getItem('lekflow:currency');
            if (saved) setCurrency(saved as Currency);
        };
        window.addEventListener('lekflow:currency-changed', handleChange);
        return () => window.removeEventListener('lekflow:currency-changed', handleChange);
    }, []);

    const format = (amountInALL: number) => {
        return baseFormat(amountInALL, currency);
    };

    return { currency, format };
}