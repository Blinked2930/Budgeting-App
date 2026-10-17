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
    <div className="h-dvh bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-hidden">
      {/* App Header */}
      <Header unsyncedCount={unsyncedCount} />

      {/* Main Content Area. All tabs stay mounted so form state survives switching. */}
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