// src/App.tsx
import { useState } from 'react';
import { Header } from './components/Header';
import { QuickEntryView } from './components/QuickEntryView';
import { BudgetView } from './components/BudgetView';
import { InsightsView } from './components/InsightsView';
import { BottomNav, type Tab } from './components/BottomNav';
import { useExpenses } from './hooks/useExpenses';

export function App() {
  const { unsyncedCount } = useExpenses();
  const [tab, setTab] = useState<Tab>('log');

  return (
    <div className="h-dvh bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900 overflow-hidden">
      <Header unsyncedCount={unsyncedCount} />

      <main className="flex-1 min-h-0 overflow-y-auto pb-28 sm:pb-32">
        <div className={tab === 'log' ? 'w-full' : 'hidden'}>
          <QuickEntryView />
        </div>
        <div className={tab === 'budget' ? 'w-full' : 'hidden'}>
          <BudgetView />
        </div>
        <div className={tab === 'insights' ? 'w-full' : 'hidden'}>
          <InsightsView />
        </div>
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

export default App;