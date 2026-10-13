import { type Currency, DEFAULT_EXCHANGE_RATES, type ExchangeRates } from '../types';

export function convertToALL(
  amount: number,
  currency: Currency,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): number {
  if (currency === 'ALL') return Math.round(amount);
  if (currency === 'EUR') return Math.round(amount * rates.EUR);
  if (currency === 'USD') return Math.round(amount * rates.USD);
  return Math.round(amount);
}

export function formatCurrency(amount: number, currency: Currency = 'ALL'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: currency === 'ALL' ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(amount);

  switch (currency) {
    case 'ALL':
      return `${formatted} L`;
    case 'EUR':
      return `€${formatted}`;
    case 'USD':
      return `$${formatted}`;
    default:
      return `${formatted} ${currency}`;
  }
}
