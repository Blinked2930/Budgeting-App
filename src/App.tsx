import { useState } from 'react';
import { Header } from './components/Header';
import { QuickEntryView } from './components/QuickEntryView';
import { BudgetView } from './components/BudgetView';
import { BottomNav, type Tab } from './components/BottomNav';
import { useExpenses } from './hooks/useExpenses';

export function App() {
  const { unsyncedCount } = useExpenses();
  const [tab, setTab] = useState<Tab>('log');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* App Header */}
      <Header unsyncedCount={unsyncedCount} />

      {/* Main Content Area. Both tabs stay mounted so form state survives switching. */}
      <main className="flex-1 flex flex-col items-center justify-start pb-28">
        <div className={tab === 'log' ? 'w-full' : 'hidden'}>
          <QuickEntryView />
        </div>
        <div className={tab === 'budget' ? 'w-full' : 'hidden'}>
          <BudgetView />
        </div>
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

export default App;