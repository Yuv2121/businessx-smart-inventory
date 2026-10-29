import { useState } from 'react';
import { X } from 'lucide-react';
import type { AppState } from '@/engine/types';
import { restock, changeSellingPrice, editItemName, editBatch } from '@/engine/fifo';
import { addItem, newItem, uid } from '@/engine/inventory';

export type EditorMode = 'addStock' | 'changePrice' | 'editName' | 'editBatch' | 'newItem';

interface Props {
  state: AppState;
  mode: EditorMode;
  itemId?: string;
  batchId?: string;
  onClose: () => void;
  onApply: (result: { state: AppState; warning?: string }) => void;
}

export default function StockEditor({ state, mode, itemId, batchId, onClose, onApply }: Props) {
  const item = state.items.find((i) => i.id === itemId);
  const batch = state.batches.find((b) => b.id === batchId);

  const [date, setDate] = useState(state.today);
  const [qty, setQty] = useState('');
  const [purchase, setPurchase] = useState('');
  const [mrp, setMrp] = useState('');
  const [newSelling, setNewSelling] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [note, setNote] = useState('');
  const [newName, setNewName] = useState(item?.name ?? '');

  // editBatch fields
  const [bpurchase, setBpurchase] = useState(batch ? String(batch.purchasePrice) : '');
  const [bmrp, setBmrp] = useState(batch ? String(batch.mrp ?? '') : '');
  const [bdate, setBdate] = useState(batch?.date ?? state.today);
  const [bqty, setBqty] = useState(batch ? String(batch.qtyBought) : '');

  // newItem fields
  const [niName, setNiName] = useState('');
  const [niUnit, setNiUnit] = useState<'pc' | 'kg' | 'L'>('pc');
  const [niSelling, setNiSelling] = useState('');
  const [niQty, setNiQty] = useState('');
  const [niCost, setNiCost] = useState('');
  const [niMrp, setNiMrp] = useState('');

  function apply() {
    switch (mode) {
      case 'addStock': {
        if (!itemId || !qty || !purchase) return;
        onApply(restock(state, itemId, Number(qty), Number(purchase), mrp ? Number(mrp) : undefined, newSelling ? Number(newSelling) : undefined, date));
        break;
      }
      case 'changePrice': {
        if (!itemId || !newPrice) return;
        onApply(changeSellingPrice(state, itemId, Number(newPrice), date, note || undefined));
        break;
      }
      case 'editName': {
        if (!itemId) return;
        onApply(editItemName(state, itemId, newName));
        break;
      }
      case 'editBatch': {
        if (!batchId) return;
        onApply(editBatch(state, batchId, {
          purchasePrice: bpurchase ? Number(bpurchase) : undefined,
          mrp: bmrp ? Number(bmrp) : undefined,
          date: bdate || undefined,
          qtyBought: bqty ? Number(bqty) : undefined,
        }));
        break;
      }
      case 'newItem': {
        if (!niName || !niSelling) return;
        const id = uid();
        const ni = newItem({ id, name: niName, unit: niUnit, sellingPrice: Number(niSelling), isLoose: niUnit !== 'pc', source: 'market', mrp: niMrp ? Number(niMrp) : undefined });
        let next = addItem(state, ni, Number(niQty) || 0, Number(niCost) || 0);
        if (niQty && niCost) {
          // addItem uses state.today for batch date; that's fine
        }
        onApply({ state: next });
        break;
      }
    }
  }

  const titleMap: Record<EditorMode, string> = {
    addStock: 'Add Stock',
    changePrice: 'Change Selling Price',
    editName: 'Edit Item Name',
    editBatch: 'Edit Batch (Correction)',
    newItem: 'New Item',
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-zinc-100">{titleMap[mode]}</div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={18} /></button>
        </div>

        {mode === 'addStock' && (
          <div className="space-y-3">
            <label className="text-xs text-zinc-400 space-y-1 block"><span>Date</span>
              <input className="input-field w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-zinc-400 space-y-1 block"><span>Qty</span>
                <input className="input-field w-full" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1 block"><span>Purchase price ₹</span>
                <input className="input-field w-full" type="number" min={0} step="0.01" value={purchase} onChange={(e) => setPurchase(e.target.value)} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1 block"><span>MRP ₹</span>
                <input className="input-field w-full" type="number" min={0} step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1 block"><span>New selling ₹ (optional)</span>
                <input className="input-field w-full" type="number" min={0} step="0.01" value={newSelling} onChange={(e) => setNewSelling(e.target.value)} />
              </label>
            </div>
          </div>
        )}

        {mode === 'changePrice' && (
          <div className="space-y-3">
            <div className="text-xs text-zinc-500">Current selling price: <span className="text-zinc-300">₹{item?.sellingPrice}</span></div>
            <label className="text-xs text-zinc-400 space-y-1 block"><span>New selling price ₹</span>
              <input className="input-field w-full" type="number" min={0} step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            </label>
            <label className="text-xs text-zinc-400 space-y-1 block"><span>Date</span>
              <input className="input-field w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="text-xs text-zinc-400 space-y-1 block"><span>Note (optional)</span>
              <input className="input-field w-full" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="text-xs text-zinc-600">Past sales keep the selling price they were sold at.</div>
          </div>
        )}

        {mode === 'editName' && (
          <div className="space-y-3">
            <label className="text-xs text-zinc-400 space-y-1 block"><span>Item name</span>
              <input className="input-field w-full" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>
            <div className="text-xs text-zinc-600">Profit never changes when you rename an item.</div>
          </div>
        )}

        {mode === 'editBatch' && batch && (
          <div className="space-y-3">
            <div className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5">
              This is a correction. Past profit will be recalculated and the change is saved in history.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-zinc-400 space-y-1 block"><span>Purchase price ₹</span>
                <input className="input-field w-full" type="number" min={0} step="0.01" value={bpurchase} onChange={(e) => setBpurchase(e.target.value)} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1 block"><span>MRP ₹</span>
                <input className="input-field w-full" type="number" min={0} step="0.01" value={bmrp} onChange={(e) => setBmrp(e.target.value)} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1 block"><span>Date</span>
                <input className="input-field w-full" type="date" value={bdate} onChange={(e) => setBdate(e.target.value)} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1 block"><span>Quantity bought</span>
                <input className="input-field w-full" type="number" min={0} value={bqty} onChange={(e) => setBqty(e.target.value)} />
              </label>
            </div>
          </div>
        )}

        {mode === 'newItem' && (
          <div className="space-y-3">
            <label className="text-xs text-zinc-400 space-y-1 block"><span>Item name</span>
              <input className="input-field w-full" value={niName} onChange={(e) => setNiName(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-zinc-400 space-y-1 block"><span>Unit</span>
                <select className="input-field w-full" value={niUnit} onChange={(e) => setNiUnit(e.target.value as 'pc' | 'kg' | 'L')}>
                  <option value="pc">Piece</option>
                  <option value="kg">Per kg</option>
                  <option value="L">Per Litre</option>
                </select>
              </label>
              <label className="text-xs text-zinc-400 space-y-1 block"><span>Selling price ₹</span>
                <input className="input-field w-full" type="number" min={0} step="0.01" value={niSelling} onChange={(e) => setNiSelling(e.target.value)} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1 block"><span>First batch qty</span>
                <input className="input-field w-full" type="number" min={0} value={niQty} onChange={(e) => setNiQty(e.target.value)} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1 block"><span>Cost ₹</span>
                <input className="input-field w-full" type="number" min={0} step="0.01" value={niCost} onChange={(e) => setNiCost(e.target.value)} />
              </label>
              <label className="text-xs text-zinc-400 space-y-1 block col-span-2"><span>MRP ₹ (optional)</span>
                <input className="input-field w-full" type="number" min={0} step="0.01" value={niMrp} onChange={(e) => setNiMrp(e.target.value)} />
              </label>
            </div>
          </div>
        )}

        <button className="btn-primary w-full" onClick={apply}>Apply</button>
      </div>
    </div>
  );
}
