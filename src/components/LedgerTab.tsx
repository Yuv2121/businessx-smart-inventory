import { useState, useMemo } from 'react';
import {
  ShoppingCart, Undo, Plus, ChevronDown, ChevronRight, CheckCircle2, XCircle,
  Tag, Package, RotateCcw, FlaskConical, ListChecks,
} from 'lucide-react';
import type { AppState } from '@/engine/types';
import {
  recordSale, restock, changeSellingPrice, customerReturn,
  getItemScreen, stockValue, weightedAvgCost, monthProfit,
  getFifoQueue, getTimeline, editItemName, editBatch, deleteBatch,
} from '@/engine/fifo';
import { seedState } from '@/data/seed';
import FifoQueue from './ledger/FifoQueue';
import Timeline from './ledger/Timeline';
import StockEditor, { type EditorMode } from './ledger/StockEditor';

interface Props {
  state: AppState;
  update: (s: AppState) => void;
}

interface Toast { msg: string; type: 'ok' | 'warn' }

export default function LedgerTab({ state, update }: Props) {
  const [selectedItemId, setSelectedItemId] = useState(
    state.items[0]?.id ?? ''
  );
  const [toast, setToast] = useState<Toast | null>(null);
  const [showQuestions, setShowQuestions] = useState(false);
  const [selfCheckResults, setSelfCheckResults] = useState<{ label: string; pass: boolean }[] | null>(null);

  // simulator inputs
  const [saleQty, setSaleQty] = useState('1');
  const [restockQty, setRestockQty] = useState('12');
  const [restockPrice, setRestockPrice] = useState('155');
  const [returnSaleId, setReturnSaleId] = useState('');
  const [returnQty, setReturnQty] = useState('1');

  // editor modal
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
  const [editBatchId, setEditBatchId] = useState<string | undefined>(undefined);

  const selectedItem = state.items.find((i) => i.id === selectedItemId);
  const itemSales = useMemo(
    () => state.sales.filter((s) => s.itemId === selectedItemId).sort((a, b) => b.date.localeCompare(a.date)),
    [state.sales, selectedItemId]
  );

  function showToast(msg: string, type: 'ok' | 'warn' = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function applyEngine(result: { state: AppState; warning?: string }) {
    update(result.state);
    if (result.warning) showToast(result.warning, 'warn');
    else showToast('Done', 'ok');
  }

  function doSale() {
    if (!selectedItemId || !saleQty) return;
    const result = recordSale(state, selectedItemId, Number(saleQty));
    applyEngine(result);
  }

  function doRestock() {
    if (!selectedItemId || !restockQty || !restockPrice) return;
    const result = restock(state, selectedItemId, Number(restockQty), Number(restockPrice));
    applyEngine(result);
  }

  function doChangePrice() {
    if (!selectedItemId) return;
    const priceStr = window.prompt('New selling price?', String(selectedItem?.sellingPrice ?? ''));
    if (!priceStr) return;
    const result = changeSellingPrice(state, selectedItemId, Number(priceStr));
    applyEngine(result);
  }

  function doReturn() {
    if (!returnSaleId || !returnQty) return;
    const result = customerReturn(state, returnSaleId, Number(returnQty));
    applyEngine(result);
  }

  function handleEditBatch(batchId: string) {
    setEditBatchId(batchId);
    setEditorMode('editBatch');
  }

  function handleDeleteBatch(batchId: string) {
    const result = deleteBatch(state, batchId);
    applyEngine(result);
  }

  function openEditor(mode: EditorMode) {
    setEditBatchId(undefined);
    setEditorMode(mode);
  }

  // ---- Self-check ----
  function runSelfCheck() {
    const oct = seedState();
    const oilItem = oct.items.find((i) => i.name === 'Fortune Sunflower Oil 1L');
    if (!oilItem) { setSelfCheckResults([{ label: 'Seed data found', pass: false }]); return; }
    const oilId = oilItem.id;

    const results: { label: string; pass: boolean }[] = [];

    // 1. FIFO queue on 31 Oct: Batch1 FINISHED (0 left @140), Batch2 SELL_FIRST (12 left @152, profit 18)
    const queue = getFifoQueue(oct, oilId);
    const b1 = queue.find((q) => q.purchasePrice === 140);
    const b2 = queue.find((q) => q.purchasePrice === 152);
    results.push({
      label: 'Batch1 FINISHED (0 left @140), Batch2 SELL_FIRST (12 left @152, profit ₹18/unit)',
      pass: !!b1 && b1.status === 'FINISHED' && b1.qtyLeft === 0 && !!b2 && b2.status === 'SELL_FIRST' && b2.qtyLeft === 12 && b2.profitPerUnitAtCurrentSelling === 18,
    });

    // 2. Edit Batch1 purchase 140→142: Oct profit becomes 636 (20 bottles × ₹2 less). Edit back: 676.
    const editUp = editBatch(oct, b1!.batchId, { purchasePrice: 142 });
    const profit636 = monthProfit(editUp.state, oilId, '2026-10');
    const editBack = editBatch(editUp.state, b1!.batchId, { purchasePrice: 140 });
    const profit676 = monthProfit(editBack.state, oilId, '2026-10');
    results.push({
      label: 'Edit Batch1 cost 140→142: profit 636, back to 140: profit 676',
      pass: Math.abs(profit636 - 636) < 0.01 && Math.abs(profit676 - 676) < 0.01,
    });

    // 3. Edit Batch1 qty from 20 to 10: blocked (20 already sold)
    const editQty = editBatch(oct, b1!.batchId, { qtyBought: 10 });
    results.push({
      label: 'Edit Batch1 qty 20→10 blocked (20 already sold)',
      pass: !!editQty.warning,
    });

    // 4. Delete Batch1: blocked. Delete a new batch with no sales: allowed.
    const delB1 = deleteBatch(oct, b1!.batchId);
    const restockResult = restock(oct, oilId, 5, 160);
    const newBatch = restockResult.state.batches.find((b) => b.purchasePrice === 160);
    const delNew = newBatch ? deleteBatch(restockResult.state, newBatch.id) : { warning: 'no batch' };
    results.push({
      label: 'Delete Batch1 blocked, delete new empty batch allowed',
      pass: !!delB1.warning && !delNew.warning,
    });

    // 5. Rename item: profit stays 676, new row in timeline
    const renamed = editItemName(oct, oilId, 'Fortune Sunflower Oil 1L Premium');
    const profitAfterRename = monthProfit(renamed.state, oilId, '2026-10');
    const tl = getTimeline(renamed.state, oilId);
    const hasEditEntry = tl.some((e) => e.type === 'EDIT');
    results.push({
      label: 'Rename: profit stays 676, edit appears in timeline',
      pass: Math.abs(profitAfterRename - 676) < 0.01 && hasEditEntry,
    });

    // 6. Timeline shows 1 Oct stock, 20 Oct stock and 20 Oct price change in correct order
    const tlOct = getTimeline(oct, oilId).sort((a, b) => a.date.localeCompare(b.date)); // oldest first
    const oct1Stock = tlOct.find((e) => e.type === 'STOCK_ADDED' && e.date === '2026-10-01');
    const oct20Stock = tlOct.find((e) => e.type === 'STOCK_ADDED' && e.date === '2026-10-20');
    const oct20Price = tlOct.find((e) => e.type === 'PRICE_CHANGED' && e.date === '2026-10-20');
    const oct1Idx = oct1Stock ? tlOct.indexOf(oct1Stock) : -1;
    const oct20StockIdx = oct20Stock ? tlOct.indexOf(oct20Stock) : -1;
    const oct20PriceIdx = oct20Price ? tlOct.indexOf(oct20Price) : -1;
    results.push({
      label: 'Timeline order: 1 Oct stock → 20 Oct stock → 20 Oct price change',
      pass: oct1Idx >= 0 && oct20StockIdx > oct1Idx && oct20PriceIdx > oct20StockIdx,
    });

    setSelfCheckResults(results);
  }

  // ---- Computed display values ----
  const screen = selectedItem ? getItemScreen(state, selectedItemId) : null;
  const sv = selectedItem ? stockValue(state, selectedItemId) : null;
  const octProfit = selectedItem ? monthProfit(state, selectedItemId, '2026-10') : 0;
  const wac = selectedItem ? weightedAvgCost(state, selectedItemId) : 0;
  const fifoQueue = selectedItem ? getFifoQueue(state, selectedItemId) : [];

  // Oct 25 sale profit (FIFO)
  const oct25Sale = itemSales.find((s) => s.date === '2026-10-25');
  const oct25ProfitFifo = oct25Sale?.profit ?? 0;
  // Oct 25 sale profit under weighted average (selling 170, wac of remaining stock at that point)
  // For display: if WAC is available, profit = 170 - wac
  const oct25ProfitWac = oct25Sale ? oct25Sale.sellingPrice - wac : 0;

  return (
    <div className="space-y-5">
      {/* A) Item picker + summary */}
      <div className="space-y-3">
        <select
          className="input-field w-full"
          value={selectedItemId}
          onChange={(e) => setSelectedItemId(e.target.value)}
        >
          {state.items.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>

        {selectedItem && screen && sv && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2">
              <div className="text-[10px] text-zinc-500">Selling now</div>
              <div className="text-lg font-semibold text-zinc-100">₹{screen.selling}</div>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2">
              <div className="text-[10px] text-zinc-500">Total stock</div>
              <div className="text-lg font-semibold text-zinc-100">{sv.totalQty}</div>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2">
              <div className="text-[10px] text-zinc-500">Stock cost</div>
              <div className="text-lg font-semibold text-zinc-100">₹{sv.cost}</div>
            </div>
          </div>
        )}
      </div>

      {/* Definition card */}
      <div className="rounded-xl bg-pink-500/5 border border-pink-500/20 px-4 py-3">
        <div className="text-xs text-zinc-400 leading-relaxed">
          <span className="text-pink-400 font-medium">FIFO rule:</span> Har purchase ka apna batch banega — apni cost ke saath.
          Sale time pe sabse purana batch pehle khareed jaata hai, aur wahi cost profit mein jaati hai.
          Purana profit kabhi change nahi hota, kyunki kuch bhi overwrite nahi hota.
        </div>
      </div>

      {/* B) FIFO Queue */}
      {selectedItem && (
        <FifoQueue state={state} itemId={selectedItemId} onEditBatch={handleEditBatch} onDeleteBatch={handleDeleteBatch} />
      )}

      {/* E) Record Sale + Customer Return */}
      {selectedItem && (
        <div className="space-y-3">
          <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 space-y-3">
            <div className="text-sm font-medium text-zinc-300 flex items-center gap-2"><ShoppingCart size={15} /> Record Sale</div>
            <div className="flex gap-2">
              <input className="input-field flex-1" type="number" min={1} placeholder="Qty" value={saleQty} onChange={(e) => setSaleQty(e.target.value)} />
              <button className="btn-primary" onClick={doSale}>Sell</button>
            </div>
          </div>

          <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 space-y-3">
            <div className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Undo size={15} /> Customer Return</div>
            <select className="input-field w-full" value={returnSaleId} onChange={(e) => setReturnSaleId(e.target.value)}>
              <option value="">Pick a recent sale...</option>
              {itemSales.slice(0, 8).map((s) => (
                <option key={s.id} value={s.id}>{s.date} — {s.qty} @ ₹{s.sellingPrice} (returned: {s.returned})</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input className="input-field flex-1" type="number" min={1} placeholder="Return qty" value={returnQty} onChange={(e) => setReturnQty(e.target.value)} />
              <button className="btn-primary" onClick={doReturn}>Return</button>
            </div>
          </div>
        </div>
      )}

      {/* D) Stock Editor buttons */}
      {selectedItem && (
        <div className="grid grid-cols-2 gap-2">
          <button className="text-sm text-zinc-300 border border-zinc-800 rounded-lg py-2.5 hover:border-pink-500/40 flex items-center justify-center gap-2" onClick={() => openEditor('addStock')}>
            <Plus size={14} /> Add Stock
          </button>
          <button className="text-sm text-zinc-300 border border-zinc-800 rounded-lg py-2.5 hover:border-pink-500/40 flex items-center justify-center gap-2" onClick={() => openEditor('changePrice')}>
            <Tag size={14} /> Change Price
          </button>
          <button className="text-sm text-zinc-300 border border-zinc-800 rounded-lg py-2.5 hover:border-pink-500/40 flex items-center justify-center gap-2" onClick={() => openEditor('editName')}>
            <Package size={14} /> Edit Name
          </button>
          <button className="text-sm text-zinc-300 border border-zinc-800 rounded-lg py-2.5 hover:border-pink-500/40 flex items-center justify-center gap-2" onClick={() => openEditor('newItem')}>
            <Plus size={14} /> New Item
          </button>
        </div>
      )}

      {/* C) Timeline */}
      {selectedItem && (
        <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4">
          <div className="text-sm font-medium text-zinc-300 mb-3">Timeline</div>
          <Timeline state={state} itemId={selectedItemId} />
        </div>
      )}

      {/* Batch + Sales tables */}
      {selectedItem && (
        <div className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Batches</div>
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-xs">
                <thead className="bg-zinc-900 text-zinc-500">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-right px-3 py-2">Bought</th>
                    <th className="text-right px-3 py-2">Left</th>
                    <th className="text-right px-3 py-2">Cost</th>
                    <th className="text-right px-3 py-2">MRP</th>
                  </tr>
                </thead>
                <tbody>
                  {state.batches.filter((b) => b.itemId === selectedItemId).sort((a,b) => a.date.localeCompare(b.date)).map((b) => (
                    <tr key={b.id} className="border-t border-zinc-800/60">
                      <td className="px-3 py-2 text-zinc-200">{b.date}</td>
                      <td className="px-3 py-2 text-right text-zinc-300">{b.qtyBought}</td>
                      <td className="px-3 py-2 text-right text-zinc-300">{b.qtyLeft}</td>
                      <td className="px-3 py-2 text-right text-zinc-300">₹{b.purchasePrice}</td>
                      <td className="px-3 py-2 text-right text-zinc-500">₹{b.mrp ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Sales Ledger</div>
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-xs">
                <thead className="bg-zinc-900 text-zinc-500">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Sell ₹</th>
                    <th className="text-right px-3 py-2">Cost used</th>
                    <th className="text-right px-3 py-2">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {itemSales.map((s) => {
                    const costUsed = s.lines.reduce((sum, l) => sum + l.qty * l.costPrice, 0);
                    return (
                      <tr key={s.id} className="border-t border-zinc-800/60">
                        <td className="px-3 py-2 text-zinc-200">{s.date}</td>
                        <td className="px-3 py-2 text-right text-zinc-300">{s.qty}{s.returned > 0 && <span className="text-blue-400"> (-{s.returned})</span>}</td>
                        <td className="px-3 py-2 text-right text-zinc-300">₹{s.sellingPrice}</td>
                        <td className="px-3 py-2 text-right text-zinc-500">₹{costUsed}</td>
                        <td className="px-3 py-2 text-right text-pink-400">₹{s.profit.toFixed(0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible: BusinessX 5 Questions */}
      <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
        <button
          className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-zinc-300"
          onClick={() => setShowQuestions((v) => !v)}
        >
          <span className="flex items-center gap-2"><FlaskConical size={15} /> BusinessX 5 Questions</span>
          {showQuestions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {showQuestions && selectedItem && screen && sv && (
          <div className="px-4 pb-4 space-y-3">
            {/* Q1: Oct 25 sale profit FIFO vs WAC */}
            <div className="bg-zinc-950/50 rounded-lg p-3 space-y-1.5">
              <div className="text-xs text-zinc-500">Q1. Oct 25 sale profit — FIFO vs Weighted Average</div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-zinc-300">FIFO: <span className="text-pink-400 font-semibold">₹{oct25ProfitFifo}</span></span>
                <span className="text-zinc-300">Wtd Avg: <span className="text-amber-400 font-semibold">₹{oct25ProfitWac.toFixed(2)}</span></span>
              </div>
              {oct25Sale && (
                <div className="text-xs text-zinc-600">
                  Sold at ₹{oct25Sale.sellingPrice}, cost from batch @₹{oct25Sale.lines[0]?.costPrice}.
                  WAC of current stock is ₹{wac.toFixed(2)}, so WAC profit = ₹{oct25Sale.sellingPrice} − ₹{wac.toFixed(2)} = ₹{oct25ProfitWac.toFixed(2)}.
                </div>
              )}
            </div>

            {/* Q2: Total real profit */}
            <div className="bg-zinc-950/50 rounded-lg p-3 space-y-1.5">
              <div className="text-xs text-zinc-500">Q2. Total real profit (October)</div>
              <div className="text-2xl font-semibold text-pink-400">₹{octProfit}</div>
            </div>

            {/* Q3: Remaining stock valuation */}
            <div className="bg-zinc-950/50 rounded-lg p-3 space-y-1.5">
              <div className="text-xs text-zinc-500">Q3. Remaining stock valuation</div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-zinc-300">Cost: <span className="text-zinc-100 font-semibold">₹{sv.cost}</span></span>
                <span className="text-zinc-300">Retail: <span className="text-zinc-100 font-semibold">₹{sv.retail}</span></span>
                <span className="text-zinc-300">Qty: <span className="text-zinc-100 font-semibold">{sv.totalQty}</span></span>
              </div>
            </div>

            {/* Q4: Item screen preview */}
            <div className="bg-zinc-950/50 rounded-lg p-3 space-y-2">
              <div className="text-xs text-zinc-500">Q4. Live Item Screen preview</div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-zinc-300">Selling: <span className="text-zinc-100">₹{screen.selling}</span></span>
                <span className="text-zinc-300">Purchase: <span className="text-zinc-100">₹{screen.purchase}</span></span>
                <span className="text-zinc-300">MRP: <span className="text-zinc-100">₹{screen.mrp ?? '—'}</span></span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {screen.batchPills.map((p, i) => (
                  <span key={i} className={`text-xs px-2.5 py-1 rounded-full border ${p.qtyLeft === 0 ? 'border-zinc-800 text-zinc-600' : 'border-pink-500/30 text-pink-400 bg-pink-500/5'}`}>
                    {p.qtyLeft} left @₹{p.cost}
                  </span>
                ))}
              </div>
            </div>

            {/* Q5: The rule */}
            <div className="bg-zinc-950/50 rounded-lg p-3 space-y-1.5">
              <div className="text-xs text-zinc-500">Q5. The rule (in simple words)</div>
              <div className="text-sm text-zinc-300 leading-relaxed">
                Purana stock apni original cost pe pehle bikta hai (FIFO). Naya stock ka cost alag ho sakta hai, lekin selling price shelf pe ek hi rehti hai — usko change karoge to future sales pe lagti hai, purani sales wahi rehti hain.
              </div>
            </div>

            {/* Self-check */}
            <div className="bg-zinc-950/50 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-500 flex items-center gap-2"><ListChecks size={13} /> Self-check (runs on fresh October data)</div>
                <button className="text-xs border border-zinc-800 rounded-lg px-3 py-1.5 hover:border-pink-500/40 text-zinc-300 flex items-center gap-1.5" onClick={runSelfCheck}>
                  <RotateCcw size={12} /> Run
                </button>
              </div>
              {selfCheckResults && (
                <div className="space-y-1.5">
                  {selfCheckResults.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {r.pass ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" /> : <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />}
                      <span className={r.pass ? 'text-zinc-300' : 'text-red-400'}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Editor modal */}
      {editorMode && (
        <StockEditor
          state={state}
          mode={editorMode}
          itemId={selectedItemId}
          batchId={editBatchId}
          onClose={() => setEditorMode(null)}
          onApply={(result) => { applyEngine(result); setEditorMode(null); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm z-50 border ${toast.type === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
