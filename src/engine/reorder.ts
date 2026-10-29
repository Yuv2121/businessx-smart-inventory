import type { AppState, Item, Sale } from './types';
import { stockForItem } from './inventory';

export const SUPPLIER_COVER_DAYS = 7;
export const MARKET_GAP_DAYS = 4;
export const MARKET_COVER_DAYS = 3;
export const VELOCITY_WINDOW = 30;
export const HIGH_CONFIDENCE_DAYS = 21;
export const LOW_BUFFER = 1.25;

export type ReorderStatus = 'TODAY' | 'SOON' | 'LATER' | 'OK' | 'NO_SALES';
export type Confidence = 'high' | 'low';

export interface Suggestion {
  itemId: string;
  name: string;
  status: ReorderStatus;
  confidence: Confidence;
  velocity: number;
  inStockDays: number;
  stock: number;
  daysLeft: number;
  orderByDate: string;
  qty: number;
  estCash: number;
  reason: string;
  source: 'supplier' | 'market';
  supplierName?: string;
  leadDays: number;
  coverDays: number;
}

function addDaysISO(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayName(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleString('en-IN', { weekday: 'long' });
}

function fmtNum(n: number): string {
  if (n === Math.floor(n)) return String(n);
  return String(Math.round(n * 10) / 10);
}

function fmtDateShort(date: string, today: string): string {
  const diff = Math.round((new Date(date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000);
  if (diff >= 0 && diff <= 6) return weekdayName(date);
  const d = new Date(date + 'T00:00:00');
  return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);
}

function newestBatch(state: AppState, itemId: string) {
  const batches = state.batches.filter((b) => b.itemId === itemId).sort((a, b) => b.date.localeCompare(a.date));
  return batches[0] ?? null;
}

function roundQty(qty: number, item: Item): number {
  if (qty <= 0) return 0;
  if (item.cartonSize && item.cartonSize > 0) {
    return Math.ceil(qty / item.cartonSize) * item.cartonSize;
  }
  if (item.unit === 'pc') return Math.ceil(qty);
  return Math.ceil(qty * 2) / 2;
}

function buildReason(
  item: Item,
  s: { velocity: number; stock: number; daysLeft: number; status: ReorderStatus; confidence: Confidence; orderByDate: string; qty: number; leadDays: number; coverDays: number; source: string; inStockDays: number; soldOutDate: string | null }
): string {
  if (s.stock === 0 && s.status === 'TODAY' && s.soldOutDate) {
    return `Out of stock since ${fmtDateShort(s.soldOutDate, '')}. You sell about ${fmtNum(s.velocity)} a day. Order ${fmtNum(s.qty)} today.`;
  }
  if (s.confidence === 'low') {
    return `New item, only ${s.inStockDays} days of sales, so this is an estimate. Order ${fmtNum(s.qty)} by ${fmtDateShort(s.orderByDate, '')}.`;
  }
  if (s.status === 'OK' && s.qty === 0) {
    if (s.velocity === 0) return `No sales in the last 30 days. No need to buy.`;
    const daysOfStock = s.velocity > 0 ? Math.round(s.stock / s.velocity) : 0;
    if (s.velocity < 1) {
      const everyN = s.velocity > 0 ? Math.round(1 / s.velocity) : 0;
      return `You sell about 1 every ${everyN} days and have ${fmtNum(s.stock)} left. That is ${daysOfStock} days of stock. No need to buy.`;
    }
    return `You sell about ${fmtNum(s.velocity)} a day and have ${fmtNum(s.stock)} left. That is ${daysOfStock} days of stock. No need to buy.`;
  }
  if (s.source === 'market') {
    const unitLabel = item.unit === 'kg' ? 'kg' : item.unit === 'L' ? 'L' : '';
    return `Buy at Siyaganj. You sell about ${fmtNum(s.velocity)}${unitLabel ? ' ' + unitLabel : ''} a day and have ${fmtNum(s.stock)}${unitLabel ? ' ' + unitLabel : ''}. Buy ${fmtNum(s.qty)}${unitLabel ? ' ' + unitLabel : ''}.`;
  }
  return `You sell about ${fmtNum(s.velocity)} a day and have ${fmtNum(s.stock)} left. Supplier takes ${s.leadDays} days. Order ${fmtNum(s.qty)} today.`;
}

function computeSuggestion(state: AppState, item: Item): Suggestion | null {
  const stock = stockForItem(state, item.id);

  const itemBatches = state.batches
    .filter((b) => b.itemId === item.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (itemBatches.length === 0) return null;

  const itemSales = state.sales
    .filter((s) => s.itemId === item.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  const firstBD = itemBatches[0].date;

  const windowStart = addDaysISO(state.today, -VELOCITY_WINDOW + 1);
  const effectiveStart = windowStart > firstBD ? windowStart : firstBD;
  if (effectiveStart > state.today) {
    return null;
  }

  const totalDays = daysBetween(effectiveStart, state.today) + 1;

  const stockByDay = new Float64Array(totalDays);
  let runningStock = 0;
  let batchIdx = 0;
  let saleIdx = 0;

  for (let d = 0; d < totalDays; d++) {
    const curDate = addDaysISO(effectiveStart, d);
    while (batchIdx < itemBatches.length && itemBatches[batchIdx].date <= curDate) {
      runningStock += itemBatches[batchIdx].qtyBought;
      batchIdx++;
    }
    while (saleIdx < itemSales.length && itemSales[saleIdx].date < curDate) {
      runningStock -= (itemSales[saleIdx].qty - itemSales[saleIdx].returned);
      saleIdx++;
    }
    stockByDay[d] = runningStock;
  }

  let inStockDays = 0;
  for (let d = 0; d < totalDays; d++) {
    if (stockByDay[d] > 0) inStockDays++;
  }

  const salesInWindow = itemSales.filter((s) => s.date >= effectiveStart && s.date <= state.today);
  const totalSoldInWindow = salesInWindow.reduce((sum, s) => sum + (s.qty - s.returned), 0);

  let velocity = 0;
  let noSales = false;
  if (inStockDays === 0 || totalSoldInWindow === 0) {
    velocity = 0;
    noSales = true;
  } else {
    velocity = totalSoldInWindow / inStockDays;
  }

  const confidence: Confidence = inStockDays >= HIGH_CONFIDENCE_DAYS ? 'high' : 'low';

  const isMarket = item.source === 'market' || !item.supplierId;
  const supplier = state.suppliers.find((s) => s.id === item.supplierId);
  const leadDays = isMarket ? MARKET_GAP_DAYS : (supplier?.leadDays ?? 0);
  const coverDays = isMarket ? MARKET_COVER_DAYS : SUPPLIER_COVER_DAYS;

  let daysLeft = 0;
  let orderByDate = state.today;
  let status: ReorderStatus;

  if (noSales) {
    status = 'NO_SALES';
  } else if (velocity === 0) {
    status = 'OK';
    daysLeft = 999;
    orderByDate = addDaysISO(state.today, 999);
  } else {
    daysLeft = stock / velocity;
    const orderOffset = Math.floor(daysLeft) - leadDays;
    orderByDate = addDaysISO(state.today, orderOffset);
    if (stock === 0 || orderByDate <= state.today) {
      status = 'TODAY';
    } else {
      const diff = daysBetween(state.today, orderByDate);
      if (diff <= 3) status = 'SOON';
      else status = 'LATER';
    }
  }

  let qty: number;
  if (noSales || velocity === 0) {
    qty = 0;
  } else {
    const baseQty = velocity * (leadDays + coverDays) - stock;
    const adjustedQty = confidence === 'low' ? velocity * (leadDays + coverDays) * LOW_BUFFER - stock : baseQty;
    qty = roundQty(adjustedQty, item);
  }

  if (qty <= 0 && status !== 'NO_SALES') {
    status = 'OK';
    qty = 0;
  }

  const nb = newestBatch(state, item.id);
  const estCash = qty * (nb?.purchasePrice ?? 0);

  let soldOutDate: string | null = null;
  if (stock === 0) {
    for (let d = totalDays - 1; d >= 0; d--) {
      if (stockByDay[d] > 0) {
        soldOutDate = addDaysISO(effectiveStart, d + 1);
        break;
      }
    }
    if (!soldOutDate) soldOutDate = firstBD;
  }

  const reason = buildReason(item, {
    velocity, stock, daysLeft, status, confidence, orderByDate, qty, leadDays, coverDays,
    source: item.source, inStockDays, soldOutDate,
  });

  return {
    itemId: item.id,
    name: item.name,
    status,
    confidence,
    velocity: Math.round(velocity * 100) / 100,
    inStockDays,
    stock,
    daysLeft: Math.round(daysLeft * 10) / 10,
    orderByDate,
    qty,
    estCash: Math.round(estCash),
    reason,
    source: item.source,
    supplierName: supplier?.name,
    leadDays,
    coverDays,
  };
}

const STATUS_ORDER: Record<ReorderStatus, number> = { TODAY: 0, SOON: 1, LATER: 2, OK: 3, NO_SALES: 4 };

export function getSuggestions(state: AppState): Suggestion[] {
  return state.items
    .map((item) => computeSuggestion(state, item))
    .filter((s): s is Suggestion => s !== null)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

export function getMarketList(state: AppState, includeSupplierItems = false): Suggestion[] {
  const all = getSuggestions(state);
  const market = all.filter((s) => s.source === 'market' && s.qty > 0 && s.daysLeft < 5);
  if (includeSupplierItems) {
    const urgent = all.filter((s) => s.source === 'supplier' && s.status === 'TODAY');
    return [...market, ...urgent];
  }
  return market;
}
