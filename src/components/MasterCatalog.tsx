import { useState } from 'react';
import { Search, Plus, Copy } from 'lucide-react';
import type { AppState, Item, Unit } from '@/engine/types';
import { addItem, newItem, uid, stockForItem } from '@/engine/inventory';
import { MASTER_CATALOG, type CatalogEntry } from '@/data/seed';

interface Props {
  state: AppState;
  update: (s: AppState) => void;
}

export default function MasterCatalog({ state, update }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [qty, setQty] = useState('10');
  const [purchase, setPurchase] = useState('');
  const [more, setMore] = useState(false);
  const [tax, setTax] = useState('');
  const [customId, setCustomId] = useState('');
  const [added, setAdded] = useState<{ time: number }[]>([]);

  const filtered = MASTER_CATALOG.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  function doAdd(entry: CatalogEntry) {
    const item: Item = newItem({
      name: entry.name,
      unit: entry.unit as Unit,
      mrp: entry.mrp,
      sellingPrice: entry.sellingPrice,
      isLoose: entry.isLoose,
      supplierId: entry.supplierId,
      cartonSize: entry.cartonSize,
      source: (entry as { source?: Item['source'] }).source ?? 'market',
      taxPct: tax ? Number(tax) : undefined,
      customId: customId || undefined,
    });
    const next = addItem(state, item, Number(qty) || 0, Number(purchase) || entry.purchasePrice);
    update(next);
    setAdded((a) => [...a, { time: Date.now() }]);
    setSelected(null);
    setQty('10');
    setPurchase('');
    setTax('');
    setCustomId('');
  }

  function doClone(itemId: string) {
    const base = state.items.find((i) => i.id === itemId);
    if (!base) return;
    const name = window.prompt('New variant name (e.g. "500ml")', `${base.name} - variant`);
    if (!name) return;
    const priceStr = window.prompt('New selling price? (leave blank to keep same)', '');
    const newPrice = priceStr ? Number(priceStr) : undefined;
    update({ ...state, items: [...state.items, { ...base, id: uid(), name, sellingPrice: newPrice ?? base.sellingPrice }] });
  }

  const itemsAddedToday = added.length;
  const avgSec = itemsAddedToday > 1
    ? Math.round((added[added.length - 1].time - added[0].time) / (itemsAddedToday - 1) / 1000)
    : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-zinc-300">
          Items added today: <span className="text-pink-400 font-semibold">{itemsAddedToday}</span>
          {itemsAddedToday > 1 && (
            <span className="text-zinc-500 ml-3">Avg time/item: <span className="text-zinc-200">{avgSec}s</span> vs ~2 min manual</span>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
        <input
          className="input-field w-full pl-10"
          placeholder="Search catalog (oil, atta, shoes...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {filtered.map((entry) => (
          <button
            key={entry.name}
            onClick={() => {
              setSelected(entry);
              setPurchase(String(entry.purchasePrice));
            }}
            className="glow-hover bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 text-left flex items-center justify-between"
          >
            <div>
              <div className="text-sm font-medium text-zinc-100">{entry.name}</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                MRP ₹{entry.mrp ?? '—'} · Buy ₹{entry.purchasePrice} · Sell ₹{entry.sellingPrice}
              </div>
            </div>
            <Plus className="text-pink-500 shrink-0" size={18} />
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setSelected(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold text-zinc-100">{selected.name}</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-zinc-400 space-y-1">
                <span>Opening qty</span>
                <input className="input-field w-full" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1">
                <span>Purchase price ₹</span>
                <input className="input-field w-full" type="number" min={0} value={purchase} onChange={(e) => setPurchase(e.target.value)} />
              </label>
            </div>

            <button className="text-xs text-zinc-500 underline" onClick={() => setMore((m) => !m)}>
              {more ? 'Hide' : 'More options'}
            </button>
            {more && (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-zinc-400 space-y-1">
                  <span>Tax %</span>
                  <input className="input-field w-full" type="number" min={0} value={tax} onChange={(e) => setTax(e.target.value)} />
                </label>
                <label className="text-xs text-zinc-400 space-y-1">
                  <span>Custom ID</span>
                  <input className="input-field w-full" value={customId} onChange={(e) => setCustomId(e.target.value)} />
                </label>
              </div>
            )}

            <button className="btn-primary w-full" onClick={() => doAdd(selected)}>Add to inventory</button>
          </div>
        </div>
      )}

      {state.items.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="text-xs uppercase tracking-wide text-zinc-500">In your store</div>
          {state.items.map((item) => (
            <div key={item.id} className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-4 py-2.5 flex items-center justify-between">
              <div className="text-sm text-zinc-200">{item.name}</div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">Stock: {stockForItem(state, item.id)}</span>
                <button className="text-zinc-500 hover:text-pink-400" onClick={() => doClone(item.id)} title="Clone variant">
                  <Copy size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
