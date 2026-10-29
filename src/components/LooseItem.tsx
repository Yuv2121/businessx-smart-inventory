import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { AppState, Item, Unit } from '@/engine/types';
import { addItem, newItem } from '@/engine/inventory';

interface Props {
  state: AppState;
  update: (s: AppState) => void;
}

export default function LooseItem({ state, update }: Props) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<Unit>('kg');
  const [qty, setQty] = useState('');
  const [purchase, setPurchase] = useState('');
  const [selling, setSelling] = useState('');
  const [mrp, setMrp] = useState('');
  const [more, setMore] = useState(false);
  const [tax, setTax] = useState('');
  const [customId, setCustomId] = useState('');

  function save() {
    if (!name || !selling || !purchase) return;
    const item: Item = newItem({
      name,
      unit,
      mrp: mrp ? Number(mrp) : undefined,
      sellingPrice: Number(selling),
      isLoose: true,
      source: 'market',
      taxPct: tax ? Number(tax) : undefined,
      customId: customId || undefined,
    });
    update(addItem(state, item, Number(qty) || 0, Number(purchase)));
    setName(''); setQty(''); setPurchase(''); setSelling(''); setMrp(''); setTax(''); setCustomId('');
  }

  return (
    <div className="space-y-4">
      <input className="input-field w-full" placeholder="Item name (e.g. Loose Rice per kg)" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="grid grid-cols-3 gap-2">
        {(['kg', 'L', 'pc'] as Unit[]).map((u) => (
          <button
            key={u}
            className={`rounded-lg px-3 py-2 text-sm font-medium border ${unit === u ? 'border-pink-500 text-pink-400 bg-pink-500/10' : 'border-zinc-800 text-zinc-400'}`}
            onClick={() => setUnit(u)}
          >
            {u === 'kg' ? 'Per kg' : u === 'L' ? 'Per Litre' : 'Per piece'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-zinc-400 space-y-1">
          <span>Opening stock ({unit})</span>
          <input className="input-field w-full" type="number" min={0} step="0.001" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label className="text-xs text-zinc-400 space-y-1">
          <span>MRP ₹ (optional)</span>
          <input className="input-field w-full" type="number" min={0} step="0.01" placeholder="—" value={mrp} onChange={(e) => setMrp(e.target.value)} />
        </label>
        <label className="text-xs text-zinc-400 space-y-1">
          <span>Purchase price ₹</span>
          <input className="input-field w-full" type="number" min={0} step="0.01" value={purchase} onChange={(e) => setPurchase(e.target.value)} />
        </label>
        <label className="text-xs text-zinc-400 space-y-1">
          <span>Selling price ₹</span>
          <input className="input-field w-full" type="number" min={0} step="0.01" value={selling} onChange={(e) => setSelling(e.target.value)} />
        </label>
      </div>

      <button className="text-xs text-zinc-500 underline" onClick={() => setMore((m) => !m)}>{more ? 'Hide' : 'More options'}</button>
      {more && (
        <div className="grid grid-cols-2 gap-3">
          <input className="input-field" type="number" min={0} placeholder="Tax %" value={tax} onChange={(e) => setTax(e.target.value)} />
          <input className="input-field" placeholder="Custom ID" value={customId} onChange={(e) => setCustomId(e.target.value)} />
        </div>
      )}

      <button className="btn-primary w-full" onClick={save} disabled={!name || !purchase || !selling}>
        <span className="inline-flex items-center gap-2"><Plus size={16} /> Add loose item</span>
      </button>
    </div>
  );
}
