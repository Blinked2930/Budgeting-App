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
      <header
        className="w-full max-w-md mx-auto pb-3 px-4 flex items-center justify-end gap-2 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
        }}
      >
        {unsyncedCount > 0 && (
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60"
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
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:text-white transition-colors cursor-pointer"
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
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl shadow-black/60 p-1.5 z-40 text-xs">
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer text-left font-medium"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Export to CSV</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer text-left font-medium"
                >
                  <FileJson className="w-4 h-4 text-cyan-400" />
                  <span>Export JSON Backup</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Global Toast Notification */}
      {toastMessage && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold backdrop-blur-md animate-in fade-in slide-in-from-top-2"
          style={{ top: 'max(4rem, calc(env(safe-area-inset-top) + 3rem))' }}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};