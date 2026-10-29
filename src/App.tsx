import { useState } from 'react';
import { Store, RotateCcw } from 'lucide-react';
import { useStore } from '@/store/useStore';
import Onboard from '@/components/Onboard';
import LedgerTab from '@/components/LedgerTab';
import ReorderTab from '@/components/ReorderTab';

const TABS = ['Onboard', 'Profit Ledger', 'Reorder & Agent'] as const;

function App() {
  const { state, update, commit, undo, getUndoLabel, setToday, reset } = useStore();
  const [tab, setTab] = useState<typeof TABS[number]>('Onboard');

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="sticky top-0 z-40 bg-[#09090b]/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-600 to-fuchsia-600 flex items-center justify-center">
              <Store size={18} className="text-white" />
            </div>
            <div>
              <div className="text-base font-semibold leading-tight">BusinessX</div>
              <div className="text-[10px] text-zinc-500 leading-tight">Sunil's General Store · Indore</div>
            </div>
          </div>
          <button
            className="text-xs text-zinc-400 hover:text-pink-400 inline-flex items-center gap-1.5 border border-zinc-800 rounded-lg px-2.5 py-1.5 transition-colors"
            onClick={reset}
          >
            <RotateCcw size={13} /> Reset Demo
          </button>
        </div>
        <div className="max-w-2xl mx-auto px-4 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              className={`px-3 py-2.5 text-sm whitespace-nowrap ${tab === t ? 'tab-active' : 'tab-inactive'}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        {tab === 'Onboard' && <Onboard state={state} update={update} />}
        {tab === 'Profit Ledger' && <LedgerTab state={state} update={update} />}
        {tab === 'Reorder & Agent' && <ReorderTab state={state} commit={commit} undo={undo} getUndoLabel={getUndoLabel} setToday={setToday} />}
      </main>
    </div>
  );
}

export default App;
