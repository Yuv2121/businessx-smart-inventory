import type { AppState, Item, Supplier, Batch, Sale, PriceChange, EditLog } from '@/engine/types';
import { uid } from '@/engine/inventory';
import { seedReorderState } from './seedReorder';

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const suppliers: Supplier[] = [
  { id: 'sup-1', name: 'Indore Wholesale Depot', leadDays: 3 },
  { id: 'sup-2', name: 'Krishna Distributors', leadDays: 5 },
  { id: 'sup-3', name: 'Local Market (Chhawani)', leadDays: 1 },
];

// Fixed IDs for the October demo so we can reference them in seed.
const OIL_ID = 'oil-fortune-1l';
const BATCH1_ID = 'oil-batch1';
const BATCH2_ID = 'oil-batch2';

interface PendingSale { date: string; qty: number; }

export function octoberScenario(): { batches: Batch[]; sales: Sale[]; priceChanges: PriceChange[]; item: Item } {
  const item: Item = {
    id: OIL_ID,
    name: 'Fortune Sunflower Oil 1L',
    unit: 'L',
    mrp: 175,
    sellingPrice: 170,
    isLoose: false,
    supplierId: 'sup-1',
    source: 'supplier',
    cartonSize: 24,
  };

  const batch1: Batch = {
    id: BATCH1_ID,
    itemId: OIL_ID,
    date: '2026-10-01',
    qtyBought: 20,
    qtyLeft: 0,
    purchasePrice: 140,
    mrp: 165,
  };

  const batch2: Batch = {
    id: BATCH2_ID,
    itemId: OIL_ID,
    date: '2026-10-20',
    qtyBought: 24,
    qtyLeft: 12,
    purchasePrice: 152,
    mrp: 175,
  };

  const priceChange: PriceChange = {
    id: uid(),
    itemId: OIL_ID,
    date: '2026-10-20',
    oldSelling: 160,
    newSelling: 170,
  };

  // Sales 1-19 Oct: 14 sold @160 (consumes batch1)
  // Sales 21-31 Oct: 18 sold @170 — 6 from batch1 (remaining), 12 from batch2
  // The sale on 25 Oct is exactly 1 bottle and is the FIRST sale after restock, consuming a batch1 bottle.
  const phase1Sales: PendingSale[] = [
    { date: '2026-10-03', qty: 2 },
    { date: '2026-10-05', qty: 3 },
    { date: '2026-10-08', qty: 2 },
    { date: '2026-10-10', qty: 1 },
    { date: '2026-10-12', qty: 3 },
    { date: '2026-10-15', qty: 2 },
    { date: '2026-10-18', qty: 1 },
  ]; // total 14

  const phase2Sales: PendingSale[] = [
    { date: '2026-10-25', qty: 1 }, // FIRST sale after restock, consumes batch1 bottle
    { date: '2026-10-22', qty: 2 },
    { date: '2026-10-24', qty: 3 },
    { date: '2026-10-26', qty: 4 },
    { date: '2026-10-28', qty: 3 },
    { date: '2026-10-30', qty: 5 },
  ]; // total 18

  // We need to build sales in chronological order for FIFO to work correctly.
  // But the 25 Oct sale must be the FIRST sale after restock to consume a batch1 bottle.
  // Since batch1 had 20, 14 sold in phase1, leaving 6. Phase2 consumes those 6 first (by date order).
  // To ensure 25 Oct consumes batch1, it must be the earliest-dated phase2 sale.
  // Let's reorder phase2 so 25 Oct is first in chronological processing:
  const phase2Chronological: PendingSale[] = [
    { date: '2026-10-22', qty: 2 },
    { date: '2026-10-24', qty: 3 },
    { date: '2026-10-25', qty: 1 }, // this is the 6th bottle from batch1 (2+3=5 already, this is #6)
    { date: '2026-10-26', qty: 4 },
    { date: '2026-10-28', qty: 3 },
    { date: '2026-10-30', qty: 5 },
  ];

  // Wait — we need the 25 Oct sale to consume a batch1 bottle. Batch1 has 6 left after phase1.
  // In chronological order: 22 Oct (2) + 24 Oct (3) = 5 from batch1, 25 Oct (1) = 6th from batch1. That's the last batch1 bottle.
  // Then 26 Oct onwards consumes batch2.
  // This gives: batch1 sold = 14 + 6 = 20 (qtyLeft=0). batch2 sold = 4+3+5 = 12 (qtyLeft=12). Total phase2 = 18. Correct.

  const allSales: PendingSale[] = [...phase1Sales, ...phase2Chronological];

  const sales: Sale[] = [];
  let batch1Left = 20;
  let batch2Left = 24;

  for (const ps of allSales) {
    const sellingPrice = ps.date >= '2026-10-20' ? 170 : 160;
    let qtyToSell = ps.qty;
    const lines: { batchId: string; qty: number; costPrice: number }[] = [];
    let profit = 0;

    // Consume batch1 first (oldest)
    if (batch1Left > 0 && qtyToSell > 0) {
      const take = Math.min(batch1Left, qtyToSell);
      lines.push({ batchId: BATCH1_ID, qty: take, costPrice: 140 });
      profit += take * (sellingPrice - 140);
      batch1Left -= take;
      qtyToSell -= take;
    }
    // Then batch2
    if (batch2Left > 0 && qtyToSell > 0) {
      const take = Math.min(batch2Left, qtyToSell);
      lines.push({ batchId: BATCH2_ID, qty: take, costPrice: 152 });
      profit += take * (sellingPrice - 152);
      batch2Left -= take;
      qtyToSell -= take;
    }

    sales.push({
      id: uid(),
      itemId: OIL_ID,
      date: ps.date,
      qty: ps.qty,
      sellingPrice,
      lines,
      profit,
      returned: 0,
    });
  }

  return { batches: [batch1, batch2], sales, priceChanges: [priceChange], item };
}

export function seedState(): AppState {
  const oct = octoberScenario();

  const items: Item[] = [
    oct.item,
    { id: uid(), name: 'Aashirvaad Atta 5kg', unit: 'pc', mrp: 320, sellingPrice: 305, isLoose: false, supplierId: 'sup-1', source: 'supplier', cartonSize: 10 },
    { id: uid(), name: 'Maggi 2-Min Noodles 70g', unit: 'pc', mrp: 14, sellingPrice: 13, isLoose: false, supplierId: 'sup-2', source: 'supplier', cartonSize: 48 },
    { id: uid(), name: 'Parle-G Biscuit 100g', unit: 'pc', mrp: 10, sellingPrice: 9, isLoose: false, supplierId: 'sup-2', source: 'supplier', cartonSize: 60 },
    { id: uid(), name: 'Surf Excel Easy Wash 1kg', unit: 'pc', mrp: 115, sellingPrice: 108, isLoose: false, supplierId: 'sup-2', source: 'supplier', cartonSize: 12 },
    { id: uid(), name: 'Tata Salt 1kg', unit: 'pc', mrp: 28, sellingPrice: 26, isLoose: false, supplierId: 'sup-1', source: 'supplier', cartonSize: 24 },
    { id: uid(), name: 'India Gate Basmati Rice 5kg', unit: 'pc', mrp: 525, sellingPrice: 499, isLoose: false, supplierId: 'sup-1', source: 'supplier', cartonSize: 6 },
    { id: uid(), name: 'Loose Wheat Flour (Atta) per kg', unit: 'kg', sellingPrice: 45, isLoose: true, supplierId: 'sup-3', source: 'market' },
  ];

  const editLog: EditLog[] = [];

  return {
    items,
    batches: oct.batches,
    sales: oct.sales,
    priceChanges: oct.priceChanges,
    suppliers,
    today: todayISO(),
    editLog,
  };
}

export function resetDemo(): AppState {
  return seedReorderState();
}

// Master catalog: ~25 pre-filled Indian retail items with suggested prices.
export interface CatalogEntry {
  name: string;
  unit: Item['unit'];
  mrp?: number;
  purchasePrice: number;
  sellingPrice: number;
  isLoose: boolean;
  supplierId?: string;
  cartonSize?: number;
  source?: Item['source'];
}

export const MASTER_CATALOG: CatalogEntry[] = [
  { name: 'Fortune Sunflower Oil 1L', unit: 'L', mrp: 140, purchasePrice: 118, sellingPrice: 132, isLoose: false, supplierId: 'sup-1', cartonSize: 24 },
  { name: 'Fortune Sunflower Oil 500ml', unit: 'L', mrp: 72, purchasePrice: 60, sellingPrice: 68, isLoose: false, supplierId: 'sup-1', cartonSize: 24 },
  { name: 'Aashirvaad Atta 5kg', unit: 'pc', mrp: 320, purchasePrice: 290, sellingPrice: 305, isLoose: false, supplierId: 'sup-1', cartonSize: 10 },
  { name: 'Aashirvaad Atta 2kg', unit: 'pc', mrp: 135, purchasePrice: 120, sellingPrice: 128, isLoose: false, supplierId: 'sup-1', cartonSize: 12 },
  { name: 'Maggi 2-Min Noodles 70g', unit: 'pc', mrp: 14, purchasePrice: 11, sellingPrice: 13, isLoose: false, supplierId: 'sup-2', cartonSize: 48 },
  { name: 'Parle-G Biscuit 100g', unit: 'pc', mrp: 10, purchasePrice: 7.5, sellingPrice: 9, isLoose: false, supplierId: 'sup-2', cartonSize: 60 },
  { name: 'Surf Excel Easy Wash 1kg', unit: 'pc', mrp: 115, purchasePrice: 95, sellingPrice: 108, isLoose: false, supplierId: 'sup-2', cartonSize: 12 },
  { name: 'Tata Salt 1kg', unit: 'pc', mrp: 28, purchasePrice: 22, sellingPrice: 26, isLoose: false, supplierId: 'sup-1', cartonSize: 24 },
  { name: 'India Gate Basmati Rice 5kg', unit: 'pc', mrp: 525, purchasePrice: 460, sellingPrice: 499, isLoose: false, supplierId: 'sup-1', cartonSize: 6 },
  { name: 'Amul Gold Milk 1L', unit: 'L', mrp: 72, purchasePrice: 64, sellingPrice: 70, isLoose: false, supplierId: 'sup-3', cartonSize: 24 },
  { name: 'Bikaji Bhujia 200g', unit: 'pc', mrp: 35, purchasePrice: 28, sellingPrice: 33, isLoose: false, supplierId: 'sup-2', cartonSize: 36 },
  { name: 'Lays Classic Salted 52g', unit: 'pc', mrp: 20, purchasePrice: 16, sellingPrice: 19, isLoose: false, supplierId: 'sup-2', cartonSize: 48 },
  { name: 'Colgate Strong Teeth 200g', unit: 'pc', mrp: 115, purchasePrice: 95, sellingPrice: 110, isLoose: false, supplierId: 'sup-2', cartonSize: 24 },
  { name: 'Dettol Soap 75g', unit: 'pc', mrp: 35, purchasePrice: 28, sellingPrice: 33, isLoose: false, supplierId: 'sup-2', cartonSize: 72 },
  { name: 'Lux Soft Touch 100g', unit: 'pc', mrp: 30, purchasePrice: 24, sellingPrice: 28, isLoose: false, supplierId: 'sup-2', cartonSize: 72 },
  { name: 'Nescafe Classic Coffee 100g', unit: 'pc', mrp: 280, purchasePrice: 245, sellingPrice: 270, isLoose: false, supplierId: 'sup-2', cartonSize: 12 },
  { name: 'Tata Tea Gold 500g', unit: 'pc', mrp: 290, purchasePrice: 255, sellingPrice: 280, isLoose: false, supplierId: 'sup-1', cartonSize: 12 },
  { name: 'Patanjali Mustard Oil 1L', unit: 'L', mrp: 165, purchasePrice: 140, sellingPrice: 158, isLoose: false, supplierId: 'sup-1', cartonSize: 12 },
  { name: 'Madhur Sugar 1kg', unit: 'pc', mrp: 48, purchasePrice: 42, sellingPrice: 46, isLoose: false, supplierId: 'sup-1', cartonSize: 20 },
  { name: 'Daawat Basmati Rice 1kg', unit: 'pc', mrp: 120, purchasePrice: 100, sellingPrice: 115, isLoose: false, supplierId: 'sup-1', cartonSize: 12 },
  { name: 'Britannia Marie Gold 250g', unit: 'pc', mrp: 35, purchasePrice: 28, sellingPrice: 33, isLoose: false, supplierId: 'sup-2', cartonSize: 36 },
  { name: 'Haldiram Aloo Bhujia 200g', unit: 'pc', mrp: 38, purchasePrice: 31, sellingPrice: 36, isLoose: false, supplierId: 'sup-2', cartonSize: 36 },
  { name: 'Bata Running Shoes (Men)', unit: 'pc', mrp: 1499, purchasePrice: 1100, sellingPrice: 1399, isLoose: false, source: 'market', supplierId: 'sup-3' },
  { name: 'Nike Revolution 6 Running', unit: 'pc', mrp: 3995, purchasePrice: 2800, sellingPrice: 3795, isLoose: false, source: 'market', supplierId: 'sup-3' },
  { name: 'Cotton T-Shirt (Round Neck)', unit: 'pc', mrp: 499, purchasePrice: 280, sellingPrice: 449, isLoose: false, source: 'market', supplierId: 'sup-3' },
];
