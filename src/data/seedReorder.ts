import type { AppState, Item, Supplier, Sale, Batch, PriceChange, EditLog } from '@/engine/types';
import { uid, addItem, newItem } from '@/engine/inventory';
import { restock, recordSale } from '@/engine/fifo';
import { octoberScenario } from './seed';

const SUPPLIERS: Supplier[] = [
  { id: 'S1', name: 'Agarwal Traders', leadDays: 2 },
  { id: 'S2', name: 'Jain Distributors', leadDays: 4 },
];

const TODAY = '2026-10-31';

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildItemHistory(
  state: AppState,
  item: Item,
  firstDay: string,
  dailySales: number[],
  endStock: number,
  purchasePrice: number,
  sellingPrice: number,
): AppState {
  let s = state;
  const totalSold = dailySales.reduce((a, b) => a + b, 0);
  const openingQty = totalSold + endStock;

  s = addItem(s, item, openingQty, purchasePrice);
  let cur = firstDay;
  for (const qty of dailySales) {
    if (qty > 0) {
      const r = recordSale(s, item.id, qty, cur);
      s = r.state;
    }
    cur = addDays(cur, 1);
  }
  return s;
}

export function seedReorderState(): AppState {
  const oct = octoberScenario();

  let state: AppState = {
    items: [oct.item],
    batches: oct.batches,
    sales: oct.sales,
    priceChanges: oct.priceChanges,
    suppliers: SUPPLIERS,
    today: TODAY,
    editLog: [],
  };

  const items: Array<{ item: Item; firstDay: string; dailySales: number[]; endStock: number; purchasePrice: number; sellingPrice: number }> = [
    {
      item: newItem({ name: 'Maggi 70g', unit: 'pc', sellingPrice: 14, isLoose: false, supplierId: 'S1', source: 'supplier', cartonSize: 6, mrp: 14 }),
      firstDay: '2026-09-17', dailySales: Array(45).fill(3), endStock: 4, purchasePrice: 12, sellingPrice: 14,
    },
    {
      item: newItem({ name: 'Aashirvaad Atta 5kg', unit: 'pc', sellingPrice: 275, isLoose: false, supplierId: 'S1', source: 'supplier', cartonSize: 10, mrp: 320 }),
      firstDay: '2026-09-17', dailySales: [], endStock: 0, purchasePrice: 245, sellingPrice: 275,
    },
    {
      item: newItem({ name: 'Surf Excel 1kg', unit: 'pc', sellingPrice: 210, isLoose: false, supplierId: 'S2', source: 'supplier', cartonSize: 12, mrp: 115 }),
      firstDay: '2026-09-17', dailySales: [], endStock: 14, purchasePrice: 180, sellingPrice: 210,
    },
    {
      item: newItem({ name: 'Parle-G 100g', unit: 'pc', sellingPrice: 10, isLoose: false, supplierId: 'S2', source: 'supplier', cartonSize: 24, mrp: 10 }),
      firstDay: '2026-09-17', dailySales: Array(45).fill(4), endStock: 10, purchasePrice: 9, sellingPrice: 10,
    },
    {
      item: newItem({ name: 'Dettol Handwash 200ml', unit: 'pc', sellingPrice: 99, isLoose: false, supplierId: 'S1', source: 'supplier', mrp: 99 }),
      firstDay: '2026-10-22', dailySales: Array(10).fill(2), endStock: 6, purchasePrice: 80, sellingPrice: 99,
    },
    {
      item: newItem({ name: 'Tata Salt 1kg', unit: 'pc', sellingPrice: 25, isLoose: false, supplierId: 'S1', source: 'supplier', mrp: 28 }),
      firstDay: '2026-09-17', dailySales: [], endStock: 60, purchasePrice: 22, sellingPrice: 25,
    },
    {
      item: newItem({ name: 'Loose Sugar', unit: 'kg', sellingPrice: 48, isLoose: true, source: 'market' }),
      firstDay: '2026-09-17', dailySales: Array(45).fill(6), endStock: 20, purchasePrice: 42, sellingPrice: 48,
    },
    {
      item: newItem({ name: 'Toor Dal Loose', unit: 'kg', sellingPrice: 150, isLoose: true, source: 'market' }),
      firstDay: '2026-09-17', dailySales: Array(45).fill(2), endStock: 7, purchasePrice: 130, sellingPrice: 150,
    },
  ];

  for (const entry of items) {
    state = buildItemHistory(state, entry.item, entry.firstDay, entry.dailySales, entry.endStock, entry.purchasePrice, entry.sellingPrice);
  }

  return state;
}
