import { Header } from './components/Header';
import { QuickEntryView } from './components/QuickEntryView';
import { useExpenses } from './hooks/useExpenses';
import { ShieldCheck, Database } from 'lucide-react';

export function App() {
  const { unsyncedCount } = useExpenses();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* App Header */}
      <Header unsyncedCount={unsyncedCount} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-start pb-12">
        <QuickEntryView />
      </main>

      {/* Bottom Offline-First Footer */}
      <footer className="w-full max-w-md mx-auto px-4 py-3 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-emerald-500/80" />
          <span>Dexie IndexedDB (Offline-First)</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Zero network latency</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
