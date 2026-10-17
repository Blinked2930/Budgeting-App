// src/components/Header.tsx
import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileJson, CheckCircle2 } from 'lucide-react';
import { exportToCSV, exportToJSON } from '../db';
import { downloadFile } from '../utils/export';

interface HeaderProps {
  unsyncedCount: number;
}

export const Header: React.FC<HeaderProps> = ({ unsyncedCount }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportCSV = async () => {
    setShowExportMenu(false);
    const csv = await exportToCSV();
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(csv, `lekflow-expenses-${dateStr}.csv`, 'text/csv;charset=utf-8;');
    showToast('Exported CSV successfully!');
  };

  const handleExportJSON = async () => {
    setShowExportMenu(false);
    const json = await exportToJSON();
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(json, `lekflow-expenses-${dateStr}.json`, 'application/json;charset=utf-8;');
    showToast('Exported JSON backup!');
  };

  return (
    <>
      {/* Full-width sticky background for desktop, constraining inner content to mobile width */}
      <div
        className="w-full sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <header className="max-w-md mx-auto pb-3 px-4 flex items-center justify-end gap-2">
          {unsyncedCount > 0 && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200"
              title={`${unsyncedCount} un-synced local records`}
            >
              {unsyncedCount} unsynced
            </span>
          )}

          {/* Export button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 hover:text-slate-900 transition-colors cursor-pointer shadow-sm"
              aria-label="Export data"
              title="Export expenses"
            >
              <Download className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-40 text-xs">
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left font-medium"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Export to CSV</span>
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left font-medium"
                  >
                    <FileJson className="w-4 h-4 text-cyan-600" />
                    <span>Export JSON Backup</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
      </div>

      {/* Global Toast Notification */}
      {toastMessage && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2"
          style={{ top: 'max(4rem, calc(env(safe-area-inset-top) + 3rem))' }}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};