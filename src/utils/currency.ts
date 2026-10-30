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

/**
 * Safely evaluate a simple arithmetic expression. Supports digits, decimal
 * points, whitespace, parentheses, and + - * /. Returns null on any parse
 * error or division by zero. No eval, no Function, no globals.
 */
export function evaluateAmountExpression(input: string): number | null {
  const src = input.replace(/\s+/g, '');
  if (!src) return null;
  if (!/^[0-9+\-*/().]+$/.test(src)) return null;

  // Tokenize
  const tokens: Array<number | '+' | '-' | '*' | '/' | '(' | ')'> = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
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

  // Shunting-yard to Reverse Polish Notation
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
      if (ops.length === 0) return null; // unmatched
      ops.pop(); // discard '('
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
    if (op === '(') return null; // unmatched
    output.push(op as '+' | '-' | '*' | '/');
  }

  // Evaluate RPN
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
  return result;
}