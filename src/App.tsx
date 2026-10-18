// src/App.tsx
import { useState } from 'react';
import { QuickEntryView } from './components/QuickEntryView';
import { BudgetView } from './components/BudgetView';
import { InsightsView } from './components/InsightsView';
import { SettingsView } from './components/SettingsView';
import { BottomNav, type Tab } from './components/BottomNav';

export function App() {
  const [tab, setTab] = useState<Tab>('log');

  return (
    <div className="h-[100dvh] bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900 overflow-hidden">
      <main className="flex-1 overflow-y-auto overscroll-none pb-[90px]">
        <div className={tab === 'log' ? 'block' : 'hidden'}><QuickEntryView /></div>
        <div className={tab === 'budget' ? 'block' : 'hidden'}><BudgetView /></div>
        <div className={tab === 'insights' ? 'block' : 'hidden'}><InsightsView /></div>
        <div className={tab === 'settings' ? 'block' : 'hidden'}><SettingsView /></div>
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

export default App;