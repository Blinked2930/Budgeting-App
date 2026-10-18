// src/utils/export.ts
import type { ExpenseRecord, DebtRecord, TransferRecord, BudgetCycle } from '../types';

export function exportToCSV(
  expenses: ExpenseRecord[],
  debts: DebtRecord[],
  transfers: TransferRecord[],
  cycles: BudgetCycle[]
): string {
  const lines: string[] = [];

  lines.push('--- EXPENSES ---');
  lines.push('Date,Item,Category,Amount,Currency,Amount(ALL),Paid With,Vendor,Meals,Debt ID');
  for (const e of expenses) {
    if (e.deleted) continue;
    const date = new Date(e.timestamp).toISOString().split('T')[0];
    const item = `"${(e.itemName || '').replace(/"/g, '""')}"`;
    lines.push([
      date, item, e.category, e.amount, e.currency, e.amountInALL,
      e.paidWith || 'Card', e.vendorType || '', e.estimatedMeals || '',
      e.debtId || ''
    ].join(','));
  }

  lines.push('');
  lines.push('--- DEBTS ---');
  lines.push('Date,Person,Direction,Original Amount,Remaining,Note,Status');
  for (const d of debts) {
    if (d.deleted) continue;
    const date = new Date(d.createdAt).toISOString().split('T')[0];
    const person = `"${d.counterparty.replace(/"/g, '""')}"`;
    const note = `"${(d.note || '').replace(/"/g, '""')}"`;
    lines.push([
      date, person, d.direction, d.amountALL, d.remainingALL, note, d.status
    ].join(','));
  }

  lines.push('');
  lines.push('--- TRANSFERS ---');
  lines.push('Date,Direction,Amount');
  for (const t of transfers) {
    if (t.deleted) continue;
    const date = new Date(t.timestamp).toISOString().split('T')[0];
    lines.push([date, t.direction, t.amountALL].join(','));
  }

  lines.push('');
  lines.push('--- BUDGET CYCLES ---');
  lines.push('Start Date,End Date,Stipend,Starting Bank,Starting Cash,Buffer,Travel Stash');
  for (const c of cycles) {
    if (c.deleted) continue;
    lines.push([
      c.startDate, c.targetEndDate, c.stipendAmountALL,
      c.startingRaiffeisenBalanceALL, c.startingCashALL || 0,
      c.bufferPoolALL, c.travelStashALL
    ].join(','));
  }

  return lines.join('\n');
}

export function exportToJSON(
  expenses: ExpenseRecord[],
  debts: DebtRecord[],
  transfers: TransferRecord[],
  cycles: BudgetCycle[]
): string {
  const data = {
    exportedAt: new Date().toISOString(),
    app: 'LekFlow',
    version: 1,
    expenses: expenses.filter((e) => !e.deleted),
    debts: debts.filter((d) => !d.deleted),
    transfers: transfers.filter((t) => !t.deleted),
    budgetCycles: cycles.filter((c) => !c.deleted),
  };
  return JSON.stringify(data, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}