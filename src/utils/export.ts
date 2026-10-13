import type { ExpenseRecord } from '../types';

export function exportToCSV(expenses: ExpenseRecord[]): string {
  const headers = [
    'ID',
    'Timestamp',
    'Amount',
    'Currency',
    'Amount (ALL)',
    'Category',
    'Vendor Type',
    'Item Name',
    'Food Type',
    'Estimated Meals',
    'Synced',
  ];

  const rows = expenses.map((e) => [
    `"${e.id}"`,
    `"${e.timestamp}"`,
    e.amount,
    `"${e.currency}"`,
    e.amountInALL,
    `"${e.category}"`,
    `"${e.vendorType || ''}"`,
    `"${(e.itemName || '').replace(/"/g, '""')}"`,
    `"${e.foodType || ''}"`,
    e.estimatedMeals ?? '',
    e.isSynced ? 'Yes' : 'No',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function exportToJSON(expenses: ExpenseRecord[]): string {
  return JSON.stringify(expenses, null, 2);
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

export function downloadExpensesCSV(expenses: ExpenseRecord[]) {
  const csv = exportToCSV(expenses);
  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(csv, `lekflow-expenses-${dateStr}.csv`, 'text/csv;charset=utf-8;');
}

export function downloadExpensesJSON(expenses: ExpenseRecord[]) {
  const json = exportToJSON(expenses);
  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(json, `lekflow-expenses-${dateStr}.json`, 'application/json;charset=utf-8;');
}
