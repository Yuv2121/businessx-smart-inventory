import { useState } from 'react';
import { Minus, Plus, Save } from 'lucide-react';
import type { AppState, Item } from '@/engine/types';
import { addSizeMatrix, newItem } from '@/engine/inventory';

interface Props {
  state: AppState;
  update: (s: AppState) => void;
}

const SHOE_SIZES = ['6', '7', '8', '9', '10'];
const CLOTH_SIZES = ['S', 'M', 'L', 'XL'];

export default function SizeMatrix({ state, update }: Props) {
  const [type, setType] = useState<'shoe' | 'cloth'>('shoe');
  const [name, setName] = useState('');
  const [purchase, setPurchase] = useState('');
  const [selling, setSelling] = useState('');
  const [mrp, setMrp] = useState('');
  const [qtys, setQtys] = useState<Record<string, number>>({});

  const sizes = type === 'shoe' ? SHOE_SIZES : CLOTH_SIZES;

  function setQty(size: string, delta: number) {
    setQtys((q) => ({ ...q, [size]: Math.max(0, (q[size] ?? 0) + delta) }));
  }

  function save() {
    if (!name || !purchase || !selling) return;
    const base: Item = newItem({
      name,
      unit: 'pc',
      mrp: mrp ? Number(mrp) : undefined,
      sellingPrice: Number(selling),
      isLoose: false,
      source: 'market',
    });
    const next = addSizeMatrix(state, base, sizes, qtys, Number(purchase));
    update(next);
    setName('');
    setPurchase('');
    setSelling('');
    setMrp('');
    setQtys({});
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          className={`rounded-lg px-3 py-2 text-sm font-medium border ${type === 'shoe' ? 'border-pink-500 text-pink-400 bg-pink-500/10' : 'border-zinc-800 text-zinc-400'}`}
          onClick={() => { setType('shoe'); setQtys({}); }}
        >
          Shoes (6–10)
        </button>
        <button
          className={`rounded-lg px-3 py-2 text-sm font-medium border ${type === 'cloth' ? 'border-pink-500 text-pink-400 bg-pink-500/10' : 'border-zinc-800 text-zinc-400'}`}
          onClick={() => { setType('cloth'); setQtys({}); }}
        >
          Clothing (S–XL)
        </button>
      </div>

      <div className="space-y-3">
        <input className="input-field w-full" placeholder="Item name (e.g. Bata Running Shoes)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <input className="input-field" type="number" min={0} placeholder="Buy ₹" value={purchase} onChange={(e) => setPurchase(e.target.value)} />
          <input className="input-field" type="number" min={0} placeholder="Sell ₹" value={selling} onChange={(e) => setSelling(e.target.value)} />
          <input className="input-field" type="number" min={0} placeholder="MRP ₹" value={mrp} onChange={(e) => setMrp(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {sizes.map((s) => (
          <div key={s} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-2 text-center space-y-2">
            <div className="text-xs text-zinc-400">{s}</div>
            <div className="flex items-center justify-center gap-1">
              <button className="text-zinc-500 hover:text-pink-400" onClick={() => setQty(s, -1)}><Minus size={14} /></button>
              <span className="text-sm font-medium w-6 text-center text-zinc-100">{qtys[s] ?? 0}</span>
              <button className="text-zinc-500 hover:text-pink-400" onClick={() => setQty(s, 1)}><Plus size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn-primary w-full" onClick={save} disabled={!name || !purchase || !selling}>
        <span className="inline-flex items-center gap-2"><Save size={16} /> Save all sizes</span>
      </button>
    </div>
  );
}
