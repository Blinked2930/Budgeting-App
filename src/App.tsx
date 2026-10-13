import { Header } from './components/Header';
import { QuickEntryView } from './components/QuickEntryView';
import { useExpenses } from './hooks/useExpenses';

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
    </div>
  );
}

export default App;