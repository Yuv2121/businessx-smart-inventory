import { useState, useEffect } from 'react';
import { RefreshCw, Check, Undo2, WifiOff } from 'lucide-react';
import type { AppState } from '@/engine/types';
import { getMarketList, type Suggestion } from '@/engine/reorder';
import { restock } from '@/engine/fifo';

interface MarketRow {
  itemId: string;
  name: string;
  qty: number;
  price: number;
  bought: boolean;
  estCash: number;
}

interface Props {
  state: AppState;
  commit: (s: AppState, label: string, undoSeconds?: number) => void;
  undo: () => boolean;
  getUndoLabel: () => string | null;
}

const TRIP_KEY = 'bx_market_trip';

interface TripState { rows: MarketRow[]; builtAt: string }

function loadTrip(): TripState | null {
  try {
    const raw = localStorage.getItem(TRIP_KEY);
    if (raw) return JSON.parse(raw) as TripState;
  } catch { return null; }
  return null;
}

function saveTrip(trip: TripState) {
  try { localStorage.setItem(TRIP_KEY, JSON.stringify(trip)); } catch { /* ignore */ }
}

function getLatestPurchase(s: AppState, itemId: string): number {
  const batches = s.batches.filter((b) => b.itemId === itemId).sort((a, b) => b.date.localeCompare(a.date));
  return batches[0]?.purchasePrice ?? 0;
}

function getLatestMrp(s: AppState, itemId: string): number | undefined {
  const batches = s.batches.filter((b) => b.itemId === itemId).sort((a, b) => b.date.localeCompare(a.date));
  return batches[0]?.mrp;
}

export default function MarketMode({ state, commit, undo, getUndoLabel }: Props) {
  const [includeSupplier, setIncludeSupplier] = useState(false);
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [builtAt, setBuiltAt] = useState('');
  const [undoLabel, setUndoLabel] = useState<string | null>(null);

  function buildList() {
    const suggestions = getMarketList(state, includeSupplier);
    const existing = loadTrip();
    if (existing && existing.rows.length > 0) {
      const merged = suggestions.map((s) => {
        const prev = existing.rows.find((r) => r.itemId === s.itemId && !r.bought);
        if (prev) return prev;
        return { itemId: s.itemId, name: s.name, qty: s.qty, price: getLatestPurchase(state, s.itemId), bought: false, estCash: s.estCash };
      });
      const boughtRows = existing.rows.filter((r) => r.bought && suggestions.some((s) => s.itemId === r.itemId));
      const allRows = [...merged, ...boughtRows];
      setRows(allRows);
      setBuiltAt(existing.builtAt);
      saveTrip({ rows: allRows, builtAt: existing.builtAt });
    } else {
      const newRows: MarketRow[] = suggestions.map((s) => ({
        itemId: s.itemId, name: s.name, qty: s.qty, price: getLatestPurchase(state, s.itemId), bought: false, estCash: s.estCash,
      }));
      setRows(newRows);
      const now = new Date().toISOString();
      setBuiltAt(now);
      saveTrip({ rows: newRows, builtAt: now });
    }
  }

  useEffect(() => {
    buildList();
  }, []);

  function updateRow(idx: number, changes: Partial<MarketRow>) {
    setRows((prev) => {
      const next = prev.map((r, i) => i === idx ? { ...r, ...changes } : r);
      if (changes.qty !== undefined || changes.price !== undefined) {
        next[idx].estCash = next[idx].qty * next[idx].price;
      }
      saveTrip({ rows: next, builtAt });
      return next;
    });
  }

  function tickRow(idx: number) {
    const row = rows[idx];
    if (row.bought) return;
    const mrp = getLatestMrp(state, row.itemId);
    const result = restock(state, row.itemId, row.qty, row.price, mrp, undefined, state.today);
    if (result.warning) return;
    commit(result.state, `Bought ${row.qty} ${row.name} @₹${row.price}`, 10);
    const next = rows.map((r, i) => i === idx ? { ...r, bought: true, estCash: r.qty * r.price } : r);
    setRows(next);
    saveTrip({ rows: next, builtAt });
    setUndoLabel(getUndoLabel());
  }

  function doUndo() {
    if (undo()) {
      const next = rows.map((r) => r.bought ? { ...r, bought: false } : r);
      setRows(next);
      saveTrip({ rows: next, builtAt });
      setUndoLabel(null);
    }
  }

  function startNewTrip() {
    try { localStorage.removeItem(TRIP_KEY); } catch { /* ignore */ }
    buildList();
  }

  const pendingRows = rows.filter((r) => !r.bought);
  const boughtRows = rows.filter((r) => r.bought);
  const totalEstCash = pendingRows.reduce((s, r) => s + r.qty * r.price, 0);
  const totalCashSpent = boughtRows.reduce((s, r) => s + r.qty * r.price, 0);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="bg-emerald-600/20 border border-emerald-600/30 px-4 py-2.5 flex items-center gap-2 sticky top-0 z-10">
        <WifiOff size={18} className="text-emerald-400" />
        <span className="text-base font-medium text-emerald-300">Works without internet</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-zinc-900 rounded-xl p-3 text-center">
            <div className="text-xs text-zinc-500">Items left</div>
            <div className="text-2xl font-bold">{pendingRows.length}</div>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3 text-center">
            <div className="text-xs text-zinc-500">Est. total</div>
            <div className="text-2xl font-bold text-amber-400">₹{totalEstCash}</div>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3 text-center">
            <div className="text-xs text-zinc-500">Spent</div>
            <div className="text-2xl font-bold text-emerald-400">₹{totalCashSpent}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            className={`px-4 py-2.5 rounded-xl text-base font-medium border-2 min-h-[56px] ${includeSupplier ? 'border-pink-500 text-pink-400 bg-pink-500/10' : 'border-zinc-800 text-zinc-400'}`}
            onClick={() => { setIncludeSupplier(v => !v); }}
          >
            Also show supplier items
          </button>
          <button className="px-4 py-2.5 rounded-xl text-base font-medium border-2 border-zinc-800 text-zinc-300 min-h-[56px] flex items-center gap-2" onClick={buildList}>
            <RefreshCw size={18} /> Refresh list
          </button>
          <button className="px-4 py-2.5 rounded-xl text-base font-medium border-2 border-zinc-800 text-zinc-300 min-h-[56px]" onClick={startNewTrip}>
            Start new trip
          </button>
        </div>

        {undoLabel && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-amber-300">{undoLabel}</span>
            <button className="text-sm font-medium text-amber-400 flex items-center gap-1.5 min-h-[44px] px-3" onClick={doUndo}>
              <Undo2 size={16} /> Undo (10s)
            </button>
          </div>
        )}

        <div className="space-y-2">
          {pendingRows.map((row) => {
            const realIdx = rows.indexOf(row);
            return (
              <div key={row.itemId} className="bg-zinc-900 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-medium">{row.name}</div>
                  <div className="text-lg font-bold text-amber-400">₹{row.estCash}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button className="w-12 h-12 rounded-xl bg-zinc-800 text-2xl font-bold flex items-center justify-center active:scale-95" onClick={() => updateRow(realIdx, { qty: Math.max(0, row.qty - 1) })}>−</button>
                    <input className="w-16 text-center text-xl font-bold bg-zinc-800 rounded-lg py-2 border-0" type="number" value={row.qty} onChange={(e) => updateRow(realIdx, { qty: Number(e.target.value) || 0 })} />
                    <button className="w-12 h-12 rounded-xl bg-zinc-800 text-2xl font-bold flex items-center justify-center active:scale-95" onClick={() => updateRow(realIdx, { qty: row.qty + 1 })}>+</button>
                  </div>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-base text-zinc-500">₹</span>
                    <input className="flex-1 text-lg bg-zinc-800 rounded-lg py-2 px-2 border-0 text-center" type="number" value={row.price} onChange={(e) => updateRow(realIdx, { price: Number(e.target.value) || 0 })} />
                  </div>
                  <button className="w-14 h-14 rounded-xl bg-emerald-600 flex items-center justify-center active:scale-95 shrink-0" onClick={() => tickRow(realIdx)}>
                    <Check size={28} className="text-white" />
                  </button>
                </div>
              </div>
            );
          })}

          {boughtRows.map((row) => (
            <div key={row.itemId} className="bg-emerald-600/10 rounded-xl p-3 flex items-center justify-between opacity-60">
              <div className="flex items-center gap-2">
                <Check size={20} className="text-emerald-400" />
                <span className="text-lg line-through text-zinc-400">{row.name}</span>
              </div>
              <span className="text-base text-emerald-400">Bought {row.qty} @₹{row.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
