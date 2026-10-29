import { useState, useMemo } from 'react';
import { Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import type { AppState } from '@/engine/types';
import { getSuggestions, getMarketList, type Suggestion, type ReorderStatus } from '@/engine/reorder';
import MarketMode from './MarketMode';

interface Props {
  state: AppState;
  commit: (s: AppState, label: string, undoSeconds?: number) => void;
  undo: () => boolean;
  getUndoLabel: () => string | null;
  setToday: (date: string) => void;
}

const SUBTABS = ['Suggestions', 'Siyaganj Market', 'Assistant'] as const;

function statusChip(status: ReorderStatus): { label: string; cls: string } {
  switch (status) {
    case 'TODAY': return { label: 'ORDER TODAY', cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
    case 'SOON': return { label: 'SOON', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    case 'LATER': return { label: 'LATER', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
    case 'OK': return { label: 'NO NEED', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    case 'NO_SALES': return { label: 'NO SALES', cls: 'bg-zinc-700/30 text-zinc-500 border-zinc-700' };
  }
}

const SuggestionCard = function SuggestionCard({ s }: { s: Suggestion }) {
  const chip = statusChip(s.status);
  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-100">{s.name}</div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${chip.cls}`}>{chip.label}</span>
      </div>
      <div className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
        {s.source === 'market' ? (
          <span>Siyaganj market</span>
        ) : (
          <span>{s.supplierName} · {s.leadDays}d delivery</span>
        )}
        {s.confidence === 'low' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">New item — estimate</span>
        )}
      </div>
      <div className="text-sm text-zinc-300 leading-relaxed">{s.reason}</div>
      {s.qty > 0 && (
        <div className="flex items-center gap-4 pt-1">
          <span className="text-lg font-bold text-pink-400">{s.qty}</span>
          <span className="text-xs text-zinc-500">est cash</span>
          <span className="text-sm font-semibold text-zinc-200">₹{s.estCash}</span>
        </div>
      )}
    </div>
  );
};

export default function ReorderTab({ state, commit, undo, getUndoLabel, setToday }: Props) {
  const [subtab, setSubtab] = useState<typeof SUBTABS[number]>('Suggestions');
  const [filter, setFilter] = useState<'all' | 'urgent' | 'supplier' | 'market'>('all');
  const [checks, setChecks] = useState<{ label: string; pass: boolean; expected: string; actual: string }[] | null>(null);

  const suggestions = useMemo(() => getSuggestions(state), [state]);

  const urgentCount = useMemo(() => suggestions.filter((s) => s.status === 'TODAY').length, [suggestions]);
  const totalEstCash = useMemo(() => suggestions.filter((s) => s.status === 'TODAY').reduce((sum, s) => sum + s.estCash, 0), [suggestions]);

  const filtered = useMemo(() => suggestions.filter((s) => {
    if (filter === 'all') return true;
    if (filter === 'urgent') return s.status === 'TODAY';
    if (filter === 'supplier') return s.source === 'supplier';
    if (filter === 'market') return s.source === 'market';
    return true;
  }), [suggestions, filter]);

  function runChecks() {
    const sug = getSuggestions(state);
    const find = (name: string) => sug.find((s) => s.name === name);

    const r: { label: string; pass: boolean; expected: string; actual: string }[] = [];

    const maggi = find('Maggi 70g');
    r.push({ label: 'Maggi velocity 3', pass: maggi?.velocity === 3, expected: '3', actual: String(maggi?.velocity) });
    r.push({ label: 'Maggi TODAY', pass: maggi?.status === 'TODAY', expected: 'TODAY', actual: maggi?.status ?? '?' });
    r.push({ label: 'Maggi qty 24', pass: maggi?.qty === 24, expected: '24', actual: String(maggi?.qty) });
    r.push({ label: 'Maggi cash 288', pass: maggi?.estCash === 288, expected: '288', actual: String(maggi?.estCash) });

    const atta = find('Aashirvaad Atta 5kg');
    r.push({ label: 'Atta velocity 2', pass: atta?.velocity === 2, expected: '2', actual: String(atta?.velocity) });
    r.push({ label: 'Atta stock 0', pass: atta?.stock === 0, expected: '0', actual: String(atta?.stock) });
    r.push({ label: 'Atta TODAY', pass: atta?.status === 'TODAY', expected: 'TODAY', actual: atta?.status ?? '?' });
    r.push({ label: 'Atta qty 18', pass: atta?.qty === 18, expected: '18', actual: String(atta?.qty) });
    r.push({ label: 'Atta cash 4410', pass: atta?.estCash === 4410, expected: '4410', actual: String(atta?.estCash) });

    const surf = find('Surf Excel 1kg');
    r.push({ label: 'Surf velocity 1.5', pass: surf?.velocity === 1.5, expected: '1.5', actual: String(surf?.velocity) });
    r.push({ label: 'Surf order by Thu 5 Nov', pass: surf?.orderByDate === '2026-11-05', expected: '2026-11-05', actual: surf?.orderByDate ?? '?' });
    r.push({ label: 'Surf qty 12', pass: surf?.qty === 12, expected: '12', actual: String(surf?.qty) });
    r.push({ label: 'Surf cash 2160', pass: surf?.estCash === 2160, expected: '2160', actual: String(surf?.estCash) });

    const parle = find('Parle-G 100g');
    r.push({ label: 'Parle-G velocity 4', pass: parle?.velocity === 4, expected: '4', actual: String(parle?.velocity) });
    r.push({ label: 'Parle-G TODAY', pass: parle?.status === 'TODAY', expected: 'TODAY', actual: parle?.status ?? '?' });
    r.push({ label: 'Parle-G qty 48', pass: parle?.qty === 48, expected: '48', actual: String(parle?.qty) });
    r.push({ label: 'Parle-G cash 432', pass: parle?.estCash === 432, expected: '432', actual: String(parle?.estCash) });

    const dettol = find('Dettol Handwash 200ml');
    r.push({ label: 'Dettol confidence low', pass: dettol?.confidence === 'low', expected: 'low', actual: dettol?.confidence ?? '?' });
    r.push({ label: 'Dettol order by Sun 1 Nov', pass: dettol?.orderByDate === '2026-11-01', expected: '2026-11-01', actual: dettol?.orderByDate ?? '?' });
    r.push({ label: 'Dettol qty 17', pass: dettol?.qty === 17, expected: '17', actual: String(dettol?.qty) });
    r.push({ label: 'Dettol cash 1360', pass: dettol?.estCash === 1360, expected: '1360', actual: String(dettol?.estCash) });

    const salt = find('Tata Salt 1kg');
    r.push({ label: 'Tata Salt qty 0 OK', pass: salt?.qty === 0 && salt?.status === 'OK', expected: '0/OK', actual: `${salt?.qty}/${salt?.status}` });

    const sugar = find('Loose Sugar');
    r.push({ label: 'Sugar qty 22', pass: sugar?.qty === 22, expected: '22', actual: String(sugar?.qty) });
    r.push({ label: 'Sugar cash 924', pass: sugar?.estCash === 924, expected: '924', actual: String(sugar?.estCash) });

    const toor = find('Toor Dal Loose');
    r.push({ label: 'Toor Dal qty 7', pass: toor?.qty === 7, expected: '7', actual: String(toor?.qty) });
    r.push({ label: 'Toor Dal cash 910', pass: toor?.estCash === 910, expected: '910', actual: String(toor?.estCash) });

    const oil = find('Fortune Sunflower Oil 1L');
    r.push({ label: 'Oil qty 0 OK', pass: oil?.qty === 0 && oil?.status === 'OK', expected: '0/OK', actual: `${oil?.qty}/${oil?.status}` });

    const market = getMarketList(state, false);
    const marketNames = market.map((m) => m.name).sort();
    r.push({ label: 'Market list = Sugar + Toor Dal', pass: marketNames.length === 2 && marketNames[0] === 'Loose Sugar' && marketNames[1] === 'Toor Dal Loose', expected: 'Sugar,Toor Dal', actual: marketNames.join(',') });
    const marketTotal = market.reduce((s, m) => s + m.estCash, 0);
    r.push({ label: 'Market total 1834', pass: marketTotal === 1834, expected: '1834', actual: String(marketTotal) });

    setChecks(r);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-800">
        {SUBTABS.map((t) => (
          <button key={t} className={`px-3 py-2 text-sm whitespace-nowrap ${subtab === t ? 'tab-active' : 'tab-inactive'}`} onClick={() => setSubtab(t)}>
            {t}
          </button>
        ))}
      </div>

      {subtab === 'Suggestions' && (
        <>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-zinc-300">
              <span className="text-red-400 font-semibold">{urgentCount} urgent</span>
              {totalEstCash > 0 && <span className="text-zinc-500 ml-2">est cash ₹{totalEstCash}</span>}
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-zinc-500" />
              <input type="date" className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-200" value={state.today} onChange={(e) => setToday(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['all', 'urgent', 'supplier', 'market'] as const).map((f) => (
              <button key={f} className={`text-xs px-3 py-1.5 rounded-full border ${filter === f ? 'border-pink-500/40 text-pink-400 bg-pink-500/10' : 'border-zinc-800 text-zinc-500'}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'urgent' ? 'Urgent' : f === 'supplier' ? 'Supplier' : 'Market'}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.map((s) => <SuggestionCard key={s.itemId} s={s} />)}
          </div>
        </>
      )}

      {subtab === 'Siyaganj Market' && (
        <MarketMode state={state} commit={commit} undo={undo} getUndoLabel={getUndoLabel} />
      )}

      {subtab === 'Assistant' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-12 text-center">
          <TrendingUp className="mx-auto text-zinc-700" size={32} />
          <div className="text-sm text-zinc-500 mt-2">Coming soon</div>
        </div>
      )}

      <div className="pt-4">
        <button className="btn-primary w-full" onClick={runChecks}>
          <span className="inline-flex items-center gap-2"><AlertCircle size={16} /> Run all checks</span>
        </button>
        {checks && (
          <div className="mt-3 space-y-1.5">
            {checks.map((c, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${c.pass ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
                <span className={c.pass ? 'text-emerald-400' : 'text-red-400'}>{c.pass ? '✓' : '✗'}</span>
                <span className={c.pass ? 'text-zinc-300' : 'text-red-400'}>{c.label}</span>
                {!c.pass && <span className="text-zinc-600 ml-auto">expected {c.expected}, got {c.actual}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
