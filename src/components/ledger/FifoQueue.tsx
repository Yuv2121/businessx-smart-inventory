import { Package, ArrowRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { AppState } from '@/engine/types';
import { getFifoQueue, sellingPriceHistory, type FifoQueueEntry } from '@/engine/fifo';

interface Props {
  state: AppState;
  itemId: string;
  onEditBatch: (batchId: string) => void;
  onDeleteBatch: (batchId: string) => void;
}

function statusBadge(status: FifoQueueEntry['status']) {
  switch (status) {
    case 'SELL_FIRST':
      return { label: 'SELL FIRST', cls: 'bg-pink-500/15 text-pink-400 border-pink-500/30' };
    case 'NEXT':
      return { label: 'NEXT', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    case 'WAITING':
      return { label: 'WAITING', cls: 'bg-zinc-700/30 text-zinc-400 border-zinc-700' };
    case 'FINISHED':
      return { label: 'FINISHED', cls: 'bg-zinc-800 text-zinc-600 border-zinc-800' };
  }
}

function fmtDate(d: string): string {
  const dt = new Date(d);
  return `${dt.getDate()} ${dt.toLocaleString('en-IN', { month: 'short' })} ${dt.getFullYear()}`;
}

export default function FifoQueue({ state, itemId, onEditBatch, onDeleteBatch }: Props) {
  const queue = getFifoQueue(state, itemId);
  const item = state.items.find((i) => i.id === itemId);
  const history = sellingPriceHistory(state, itemId);

  if (!item) return null;

  const activeCosts = queue.filter((q) => q.qtyLeft > 0).map((q) => q.purchasePrice);
  const firstCost = activeCosts[0];
  const lastCost = activeCosts[activeCosts.length - 1];

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-zinc-300">FIFO Queue: sell in this order</div>

      {queue.map((entry) => {
        const badge = statusBadge(entry.status);
        const edited = state.editLog.some((e) => e.batchId === entry.batchId);
        const sold = entry.sold;
        const canDelete = sold === 0 && entry.qtyLeft === entry.qtyBought;

        return (
          <div
            key={entry.batchId}
            className={`rounded-xl border p-4 ${entry.status === 'FINISHED' ? 'bg-zinc-900/40 border-zinc-800/50 opacity-60' : 'bg-zinc-900/80 border-zinc-800'}`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
                {edited && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">EDITED</span>}
              </div>
              <div className="flex gap-1.5">
                <button
                  className="text-xs text-zinc-500 hover:text-pink-400 border border-zinc-800 rounded px-2 py-1"
                  onClick={() => onEditBatch(entry.batchId)}
                >
                  Edit
                </button>
                <button
                  className="text-xs text-zinc-500 hover:text-red-400 border border-zinc-800 rounded px-2 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={!canDelete}
                  onClick={() => onDeleteBatch(entry.batchId)}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="text-sm text-zinc-200 mt-2">Stocked on {fmtDate(entry.date)}</div>

            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              <div>
                <div className="text-[10px] text-zinc-500">Bought</div>
                <div className="text-sm text-zinc-200">{entry.qtyBought}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500">Sold</div>
                <div className="text-sm text-zinc-200">{sold}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500">Left</div>
                <div className="text-sm text-zinc-200">{entry.qtyLeft}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
              <span>Purchase: <span className="text-zinc-200">₹{entry.purchasePrice}</span></span>
              <span>MRP: <span className="text-zinc-200">₹{entry.mrp ?? '—'}</span></span>
            </div>

            {entry.status === 'FINISHED' ? (
              <div className="text-xs text-zinc-600 mt-2 flex items-center gap-1.5">
                <XCircle size={12} /> Sold out on {entry.soldOutDate ? fmtDate(entry.soldOutDate) : '—'}
              </div>
            ) : (
              <div className="text-xs mt-2 flex items-center gap-1.5">
                {entry.status === 'SELL_FIRST' ? <CheckCircle2 size={12} className="text-pink-400" /> : <Clock size={12} className="text-zinc-500" />}
                <span className="text-zinc-400">If sold today at ₹{item.sellingPrice} → profit ₹{entry.profitPerUnitAtCurrentSelling} per bottle</span>
              </div>
            )}
          </div>
        );
      })}

      {activeCosts.length > 0 && (
        <div className="text-xs text-zinc-500 px-1">
          {activeCosts.length > 1
            ? `Old stock (₹${firstCost}) sells first, then new stock (₹${lastCost}). Selling price for all bottles on the shelf is ₹${item.sellingPrice}.`
            : `All bottles on shelf cost ₹${firstCost}. Selling price is ₹${item.sellingPrice}.`}
        </div>
      )}

      {history.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-500 px-1">
          <Package size={12} />
          <span>Selling price history:</span>
          {history.map((h, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <ArrowRight size={11} className="text-zinc-700" />}
              <span className="text-zinc-300">₹{h.price} <span className="text-zinc-600">({fmtDate(h.date)})</span></span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
