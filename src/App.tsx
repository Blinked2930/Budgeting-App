// src/App.tsx
import { useState, useRef, useEffect } from 'react';
import { QuickEntryView } from './components/QuickEntryView';
import { BudgetView } from './components/BudgetView';
import { InsightsView } from './components/InsightsView';
import { SettingsView } from './components/SettingsView';
import { BottomNav, type Tab } from './components/BottomNav';

export function App() {
  const [tab, setTab] = useState<Tab>('log');
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [tab]);

  return (
    <div className="h-[100dvh] bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900 overflow-hidden">
      <main
        ref={mainRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y pb-[90px]"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
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