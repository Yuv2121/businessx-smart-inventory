import type { AppState, Batch, Sale, SaleLine, PriceChange, EditLog, Item } from './types';
import { uid } from './inventory';

export interface EngineResult {
  state: AppState;
  warning?: string;
}

// ---------- helpers ----------

function batchesForItem(state: AppState, itemId: string, size?: string): Batch[] {
  return state.batches
    .filter((b) => b.itemId === itemId && (size ? b.size === size : true))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return 0; // preserve creation order within same date
    });
}

function soldFromBatch(state: AppState, batchId: string): number {
  let sold = 0;
  for (const s of state.sales) {
    for (const line of s.lines) {
      if (line.batchId === batchId) sold += line.qty;
    }
  }
  return sold;
}

// ---------- restock ----------

export function restock(
  state: AppState,
  itemId: string,
  qty: number,
  purchasePrice: number,
  mrp?: number,
  newSelling?: number,
  date?: string,
  size?: string
): EngineResult {
  if (qty <= 0) return { state, warning: 'Quantity must be greater than 0' };
  if (purchasePrice <= 0) return { state, warning: 'Purchase price must be greater than 0' };

  const item = state.items.find((i) => i.id === itemId);
  if (!item) return { state, warning: 'Item not found' };

  const batch: Batch = {
    id: uid(),
    itemId,
    size,
    date: date ?? state.today,
    qtyBought: qty,
    qtyLeft: qty,
    purchasePrice,
    mrp: mrp ?? item.mrp,
  };

  let items = state.items;
  const priceChanges = [...state.priceChanges];

  if (newSelling !== undefined && newSelling > 0 && newSelling !== item.sellingPrice) {
    const pc: PriceChange = {
      id: uid(),
      itemId,
      date: date ?? state.today,
      oldSelling: item.sellingPrice,
      newSelling,
    };
    priceChanges.push(pc);
    items = items.map((i) => (i.id === itemId ? { ...i, sellingPrice: newSelling, mrp: mrp ?? i.mrp } : i));
  }

  return {
    state: {
      ...state,
      items,
      batches: [...state.batches, batch],
      priceChanges,
    },
  };
}

// ---------- changeSellingPrice ----------

export function changeSellingPrice(
  state: AppState,
  itemId: string,
  newPrice: number,
  date?: string,
  note?: string
): EngineResult {
  if (newPrice <= 0) return { state, warning: 'Selling price must be greater than 0' };
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return { state, warning: 'Item not found' };
  if (newPrice === item.sellingPrice) return { state, warning: 'New price is same as current' };

  const pc: PriceChange = {
    id: uid(),
    itemId,
    date: date ?? state.today,
    oldSelling: item.sellingPrice,
    newSelling: newPrice,
  };

  return {
    state: {
      ...state,
      items: state.items.map((i) => (i.id === itemId ? { ...i, sellingPrice: newPrice } : i)),
      priceChanges: [...state.priceChanges, pc],
    },
  };
}

// ---------- recordSale ----------

export function recordSale(
  state: AppState,
  itemId: string,
  qty: number,
  date?: string,
  size?: string
): EngineResult {
  if (qty <= 0) return { state, warning: 'Quantity must be greater than 0' };
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return { state, warning: 'Item not found' };

  const sortedBatches = batchesForItem(state, itemId, size).filter((b) => b.qtyLeft > 0);
  const totalAvailable = sortedBatches.reduce((s, b) => s + b.qtyLeft, 0);

  let warning: string | undefined;
  let qtyToSell = qty;
  if (qtyToSell > totalAvailable) {
    warning = `Only ${totalAvailable} in stock. Sold ${totalAvailable}, ${qtyToSell - totalAvailable} short.`;
    qtyToSell = totalAvailable;
  }

  if (qtyToSell === 0) return { state, warning: warning ?? 'No stock available' };

  const lines: SaleLine[] = [];
  let profit = 0;
  const sellingPrice = item.sellingPrice;

  const batchUpdates: Record<string, number> = {};
  for (const batch of sortedBatches) {
    if (qtyToSell <= 0) break;
    const take = Math.min(batch.qtyLeft, qtyToSell);
    lines.push({ batchId: batch.id, qty: take, costPrice: batch.purchasePrice });
    profit += take * (sellingPrice - batch.purchasePrice);
    batchUpdates[batch.id] = batch.qtyLeft - take;
    qtyToSell -= take;
  }

  const sale: Sale = {
    id: uid(),
    itemId,
    size,
    date: date ?? state.today,
    qty: lines.reduce((s, l) => s + l.qty, 0),
    sellingPrice,
    lines,
    profit,
    returned: 0,
  };

  return {
    state: {
      ...state,
      batches: state.batches.map((b) =>
        batchUpdates[b.id] !== undefined ? { ...b, qtyLeft: batchUpdates[b.id] } : b
      ),
      sales: [...state.sales, sale],
    },
    warning,
  };
}

// ---------- customerReturn ----------

export function customerReturn(state: AppState, saleId: string, qty: number): EngineResult {
  if (qty <= 0) return { state, warning: 'Return quantity must be greater than 0' };
  const sale = state.sales.find((s) => s.id === saleId);
  if (!sale) return { state, warning: 'Sale not found' };

  const alreadyReturned = sale.returned;
  const returnable = sale.qty - alreadyReturned;
  if (qty > returnable) return { state, warning: `Can only return ${returnable} more from this sale` };

  // Put qty back into the SAME batches — newest-taken first (reverse of lines)
  let qtyToReturn = qty;
  const batchUpdates: Record<string, number> = {};
  const reversedLines = [...sale.lines].reverse();

  for (const line of reversedLines) {
    if (qtyToReturn <= 0) break;
    const batch = state.batches.find((b) => b.id === line.batchId);
    if (!batch) continue;
    const putBack = Math.min(line.qty, qtyToReturn);
    batchUpdates[batch.id] = (batchUpdates[batch.id] ?? batch.qtyLeft) + putBack;
    qtyToReturn -= putBack;
  }

  // Reduce profit proportionally
  const profitPerUnit = sale.qty > 0 ? sale.profit / sale.qty : 0;
  const newProfit = sale.profit - qty * profitPerUnit;

  return {
    state: {
      ...state,
      batches: state.batches.map((b) =>
        batchUpdates[b.id] !== undefined ? { ...b, qtyLeft: batchUpdates[b.id] } : b
      ),
      sales: state.sales.map((s) =>
        s.id === saleId ? { ...s, returned: s.returned + qty, profit: newProfit } : s
      ),
    },
  };
}

// ---------- getItemScreen ----------

export interface BatchPill {
  qtyLeft: number;
  cost: number;
}

export interface ItemScreen {
  selling: number;
  purchase: number;
  mrp?: number;
  batchPills: BatchPill[];
}

export function getItemScreen(state: AppState, itemId: string): ItemScreen | null {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return null;

  const sorted = batchesForItem(state, itemId);
  const withStock = sorted.filter((b) => b.qtyLeft > 0);

  let purchase: number;
  if (withStock.length > 0) {
    purchase = withStock[0].purchasePrice; // oldest batch with stock
  } else {
    purchase = sorted.length > 0 ? sorted[sorted.length - 1].purchasePrice : 0; // latest batch
  }

  const latestBatch = sorted.length > 0 ? sorted[sorted.length - 1] : undefined;
  const mrp = latestBatch?.mrp ?? item.mrp;

  const batchPills: BatchPill[] = sorted.map((b) => ({ qtyLeft: b.qtyLeft, cost: b.purchasePrice }));

  return { selling: item.sellingPrice, purchase, mrp, batchPills };
}

// ---------- stockValue ----------

export function stockValue(state: AppState, itemId: string): { cost: number; retail: number; totalQty: number } {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return { cost: 0, retail: 0, totalQty: 0 };
  const batches = batchesForItem(state, itemId);
  const totalQty = batches.reduce((s, b) => s + b.qtyLeft, 0);
  const cost = batches.reduce((s, b) => s + b.qtyLeft * b.purchasePrice, 0);
  const retail = totalQty * item.sellingPrice;
  return { cost, retail, totalQty };
}

// ---------- weightedAvgCost ----------

export function weightedAvgCost(state: AppState, itemId: string): number {
  const batches = batchesForItem(state, itemId).filter((b) => b.qtyLeft > 0);
  const totalQty = batches.reduce((s, b) => s + b.qtyLeft, 0);
  if (totalQty === 0) return 0;
  const totalCost = batches.reduce((s, b) => s + b.qtyLeft * b.purchasePrice, 0);
  return totalCost / totalQty;
}

// ---------- monthProfit ----------

export function monthProfit(state: AppState, itemId: string, month: string): number {
  return state.sales
    .filter((s) => s.itemId === itemId && s.date.startsWith(month))
    .reduce((sum, s) => sum + s.profit, 0);
}

// ============ SPEC 2 ADDITIONS ============

// ---------- getFifoQueue ----------

export interface FifoQueueEntry {
  batchId: string;
  date: string;
  qtyBought: number;
  sold: number;
  qtyLeft: number;
  purchasePrice: number;
  mrp?: number;
  status: 'SELL_FIRST' | 'NEXT' | 'WAITING' | 'FINISHED';
  profitPerUnitAtCurrentSelling: number;
  soldOutDate?: string;
}

export function getFifoQueue(state: AppState, itemId: string, size?: string): FifoQueueEntry[] {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return [];

  const sorted = batchesForItem(state, itemId, size);
  const entries: FifoQueueEntry[] = [];

  let firstWithStockFound = false;
  let secondWithStockFound = false;

  for (const batch of sorted) {
    const sold = soldFromBatch(state, batch.id);
    const qtyLeft = batch.qtyLeft;
    let status: FifoQueueEntry['status'];
    let soldOutDate: string | undefined;

    if (qtyLeft > 0) {
      if (!firstWithStockFound) {
        status = 'SELL_FIRST';
        firstWithStockFound = true;
      } else if (!secondWithStockFound) {
        status = 'NEXT';
        secondWithStockFound = true;
      } else {
        status = 'WAITING';
      }
    } else {
      status = 'FINISHED';
      // find the sale date that finished this batch
      let cumulative = 0;
      const salesChrono = [...state.sales]
        .filter((s) => s.itemId === itemId)
        .sort((a, b) => a.date.localeCompare(b.date));
      for (const sale of salesChrono) {
        const line = sale.lines.find((l) => l.batchId === batch.id);
        if (line) {
          cumulative += line.qty;
          if (cumulative >= batch.qtyBought) {
            soldOutDate = sale.date;
            break;
          }
        }
      }
    }

    entries.push({
      batchId: batch.id,
      date: batch.date,
      qtyBought: batch.qtyBought,
      sold,
      qtyLeft,
      purchasePrice: batch.purchasePrice,
      mrp: batch.mrp,
      status,
      profitPerUnitAtCurrentSelling: item.sellingPrice - batch.purchasePrice,
      soldOutDate,
    });
  }

  return entries;
}

// ---------- getTimeline ----------

export type TimelineType = 'STOCK_ADDED' | 'PRICE_CHANGED' | 'SALE' | 'RETURN' | 'EDIT';

export interface TimelineEntry {
  type: TimelineType;
  date: string;
  label: string;
  icon: string;
}

export function getTimeline(state: AppState, itemId: string): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  // Stock added
  for (const b of batchesForItem(state, itemId)) {
    entries.push({
      type: 'STOCK_ADDED',
      date: b.date,
      label: `${b.qtyBought} bottles added at ₹${b.purchasePrice} (MRP ₹${b.mrp ?? '—'})`,
      icon: 'stock',
    });
  }

  // Price changes
  for (const pc of state.priceChanges.filter((p) => p.itemId === itemId)) {
    entries.push({
      type: 'PRICE_CHANGED',
      date: pc.date,
      label: `Selling price changed ₹${pc.oldSelling} -> ₹${pc.newSelling}`,
      icon: 'price',
    });
  }

  // Sales
  for (const s of state.sales.filter((sa) => sa.itemId === itemId)) {
    entries.push({
      type: 'SALE',
      date: s.date,
      label: `${s.qty} sold @ ₹${s.sellingPrice} — profit ₹${s.profit}`,
      icon: 'sale',
    });
    if (s.returned > 0) {
      entries.push({
        type: 'RETURN',
        date: s.date,
        label: `${s.returned} returned from this sale`,
        icon: 'return',
      });
    }
  }

  // Edits
  for (const e of state.editLog.filter((el) => el.itemId === itemId)) {
    entries.push({
      type: 'EDIT',
      date: e.date,
      label: `${e.field} changed from "${e.oldValue}" to "${e.newValue}"${e.note ? ` (${e.note})` : ''}`,
      icon: 'edit',
    });
  }

  // Sort newest first
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}

// ---------- editItemName ----------

export function editItemName(state: AppState, itemId: string, newName: string): EngineResult {
  const trimmed = newName.trim();
  if (!trimmed) return { state, warning: 'Name cannot be empty' };
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return { state, warning: 'Item not found' };
  if (trimmed === item.name) return { state, warning: 'Name is the same' };
  const dup = state.items.find((i) => i.name.toLowerCase() === trimmed.toLowerCase() && i.id !== itemId);
  if (dup) return { state, warning: `Another item named "${trimmed}" already exists` };

  const log: EditLog = {
    id: uid(),
    date: state.today,
    itemId,
    field: 'name',
    oldValue: item.name,
    newValue: trimmed,
  };

  return {
    state: {
      ...state,
      items: state.items.map((i) => (i.id === itemId ? { ...i, name: trimmed } : i)),
      editLog: [...state.editLog, log],
    },
  };
}

// ---------- editBatch ----------

export function editBatch(
  state: AppState,
  batchId: string,
  changes: { purchasePrice?: number; mrp?: number; date?: string; qtyBought?: number }
): EngineResult {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) return { state, warning: 'Batch not found' };

  const logs: EditLog[] = [];
  let newPurchasePrice = batch.purchasePrice;
  let newMrp = batch.mrp;
  let newDate = batch.date;
  let newQtyBought = batch.qtyBought;

  if (changes.purchasePrice !== undefined) {
    if (changes.purchasePrice <= 0) return { state, warning: 'Purchase price must be greater than 0' };
    if (changes.purchasePrice !== batch.purchasePrice) {
      logs.push({
        id: uid(), date: state.today, itemId: batch.itemId, batchId,
        field: 'purchasePrice', oldValue: String(batch.purchasePrice), newValue: String(changes.purchasePrice),
      });
      newPurchasePrice = changes.purchasePrice;
    }
  }

  if (changes.mrp !== undefined && changes.mrp !== batch.mrp) {
    logs.push({
      id: uid(), date: state.today, itemId: batch.itemId, batchId,
      field: 'mrp', oldValue: String(batch.mrp ?? ''), newValue: String(changes.mrp),
    });
    newMrp = changes.mrp;
  }

  if (changes.date !== undefined && changes.date !== batch.date) {
    logs.push({
      id: uid(), date: state.today, itemId: batch.itemId, batchId,
      field: 'date', oldValue: batch.date, newValue: changes.date,
    });
    newDate = changes.date;
  }

  if (changes.qtyBought !== undefined && changes.qtyBought !== batch.qtyBought) {
    const sold = soldFromBatch(state, batchId);
    if (changes.qtyBought < sold) {
      return { state, warning: `Cannot reduce below ${sold} — that many were already sold from this batch` };
    }
    logs.push({
      id: uid(), date: state.today, itemId: batch.itemId, batchId,
      field: 'qtyBought', oldValue: String(batch.qtyBought), newValue: String(changes.qtyBought),
    });
    newQtyBought = changes.qtyBought;
  }

  // Compute new qtyLeft = qtyBought - sold (after returns)
  const sold = soldFromBatch(state, batchId);
  const newQtyLeft = newQtyBought - sold;

  // Update batch
  const newBatches = state.batches.map((b) =>
    b.id === batchId
      ? { ...b, purchasePrice: newPurchasePrice, mrp: newMrp, date: newDate, qtyBought: newQtyBought, qtyLeft: newQtyLeft }
      : b
  );

  // If purchasePrice changed, update costPrice in all sale lines that used this batch and recompute profit
  let newSales = state.sales;
  if (newPurchasePrice !== batch.purchasePrice) {
    newSales = state.sales.map((s) => {
      if (!s.lines.some((l) => l.batchId === batchId)) return s;
      const newLines = s.lines.map((l) =>
        l.batchId === batchId ? { ...l, costPrice: newPurchasePrice } : l
      );
      const newProfit = newLines.reduce((sum, l) => sum + l.qty * (s.sellingPrice - l.costPrice), 0);
      return { ...s, lines: newLines, profit: newProfit };
    });
  }

  return {
    state: {
      ...state,
      batches: newBatches,
      sales: newSales,
      editLog: [...state.editLog, ...logs],
    },
  };
}

// ---------- deleteBatch ----------

export function deleteBatch(state: AppState, batchId: string): EngineResult {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) return { state, warning: 'Batch not found' };
  const sold = soldFromBatch(state, batchId);
  if (sold > 0) {
    return { state, warning: 'Already sold from this batch. Edit it instead.' };
  }
  return {
    state: {
      ...state,
      batches: state.batches.filter((b) => b.id !== batchId),
    },
  };
}

// ---------- batchIsEdited ----------

export function batchIsEdited(state: AppState, batchId: string): boolean {
  return state.editLog.some((e) => e.batchId === batchId);
}

// ---------- selling price history ----------

export function sellingPriceHistory(state: AppState, itemId: string): { date: string; price: number }[] {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return [];
  const changes = state.priceChanges
    .filter((p) => p.itemId === itemId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const history: { date: string; price: number }[] = [];
  if (changes.length > 0) {
    history.push({ date: changes[0].date, price: changes[0].oldSelling });
    for (const c of changes) {
      history.push({ date: c.date, price: c.newSelling });
    }
  } else {
    history.push({ date: state.today, price: item.sellingPrice });
  }
  return history;
}
