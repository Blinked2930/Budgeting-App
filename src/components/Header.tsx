import React, { useState } from 'react';
import { Download, Wifi, WifiOff, FileSpreadsheet, FileJson, CheckCircle2 } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { exportToCSV, exportToJSON } from '../db';
import { downloadFile } from '../utils/export';

interface HeaderProps {
  unsyncedCount: number;
}

export const Header: React.FC<HeaderProps> = ({ unsyncedCount }) => {
  const { isOnline } = useNetworkStatus();
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
      <header className="w-full max-w-md mx-auto pt-4 pb-3 px-4 flex items-center justify-between border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black text-lg tracking-wider">
            L
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold text-slate-100 tracking-tight">LekFlow</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Peace Corps Albania</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Offline / Online badge */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              isOnline
                ? 'bg-slate-900 border-slate-800 text-slate-300'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
            }`}
            title={isOnline ? 'Online - Dexie offline-first' : 'Offline mode active'}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px]">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-400" />
                <span className="text-[10px]">Offline</span>
              </>
            )}
          </div>

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
        </div>
      </header>

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};
