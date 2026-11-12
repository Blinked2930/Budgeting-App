// src/utils/currency.ts
import { type Currency, DEFAULT_EXCHANGE_RATES, type ExchangeRates } from '../types';

export function convertToALL(
  amount: number,
  currency: Currency,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): number {
  if (currency === 'ALL') return Math.round(amount);
  const rate = rates[currency] ?? 1;
  return Math.round(amount * rate);
}

export function convertToALLPrecise(
  amount: number,
  currency: Currency,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): number {
  if (currency === 'ALL') return Math.round(amount * 100) / 100;
  const rate = rates[currency] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

export function convertFromALL(
  amountALL: number,
  currency: Currency = 'ALL',
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES
): number {
  if (currency === 'ALL') return Math.round(amountALL);
  const rate = rates[currency] ?? 1;
  return Math.round((amountALL / rate) * 100) / 100;
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
    case 'GBP':
      return `£${formatted}`;
    default:
      return `${formatted} ${currency}`;
  }
}

export function evaluateAmountExpression(input: string): number | null {
  if (!input) return null;

  let src = input
    .replace(/\s+/g, '')
    .replace(/[×xX]/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/[–—]/g, '-')
    .replace(/,/g, '.');

  if (!src) return null;

  while (src.length > 0 && /[+\-*/.]$/.test(src)) {
    src = src.slice(0, -1);
  }
  if (!src) return null;
  if (!/^[0-9+\-*/().]+$/.test(src)) return null;

  const tokens: Array<number | '+' | '-' | '*' | '/' | '(' | ')'> = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const prev = tokens.length > 0 ? tokens[tokens.length - 1] : null;
    const isUnaryContext = prev === null || prev === '(' || prev === '+' || prev === '-' || prev === '*' || prev === '/';

    if (ch === '-' && isUnaryContext && i + 1 < src.length && (/[0-9.]/.test(src[i + 1]))) {
      let j = i + 1;
      while (j < src.length && (/[0-9.]/.test(src[j]))) j++;
      const raw = src.slice(i, j);
      const num = Number(raw);
      if (Number.isNaN(num)) return null;
      tokens.push(num);
      i = j;
    } else if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      tokens.push(ch);
      i++;
    } else if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i;
      while (j < src.length && (/[0-9.]/.test(src[j]))) j++;
      const raw = src.slice(i, j);
      const num = Number(raw);
      if (Number.isNaN(num)) return null;
      tokens.push(num);
      i = j;
    } else {
      return null;
    }
  }

  const output: Array<number | '+' | '-' | '*' | '/'> = [];
  const ops: Array<'+' | '-' | '*' | '/' | '('> = [];
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

  for (const tok of tokens) {
    if (typeof tok === 'number') {
      output.push(tok);
    } else if (tok === '(') {
      ops.push(tok);
    } else if (tok === ')') {
      while (ops.length > 0 && ops[ops.length - 1] !== '(') {
        output.push(ops.pop() as '+' | '-' | '*' | '/');
      }
      if (ops.length === 0) return null;
      ops.pop();
    } else {
      while (
        ops.length > 0 &&
        ops[ops.length - 1] !== '(' &&
        precedence[ops[ops.length - 1] as string] >= precedence[tok]
      ) {
        output.push(ops.pop() as '+' | '-' | '*' | '/');
      }
      ops.push(tok);
    }
  }
  while (ops.length > 0) {
    const op = ops.pop();
    if (op === '(') return null;
    output.push(op as '+' | '-' | '*' | '/');
  }

  const stack: number[] = [];
  for (const tok of output) {
    if (typeof tok === 'number') {
      stack.push(tok);
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) return null;
      switch (tok) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/':
          if (b === 0) return null;
          stack.push(a / b);
          break;
      }
    }
  }
  if (stack.length !== 1) return null;
  const result = stack[0];
  if (!Number.isFinite(result)) return null;
  return Math.round(result * 100) / 100;
}