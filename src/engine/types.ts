export type Unit = 'pc' | 'kg' | 'L';

export interface Item {
  id: string;
  name: string;
  unit: Unit;
  mrp?: number;
  sellingPrice: number;
  taxPct?: number;
  customId?: string;
  sizes?: string[];
  isLoose: boolean;
  supplierId?: string;
  cartonSize?: number;
  source: 'supplier' | 'market';
}

export interface Batch {
  id: string;
  itemId: string;
  size?: string;
  date: string;
  qtyBought: number;
  qtyLeft: number;
  purchasePrice: number;
  mrp?: number;
}

export interface SaleLine {
  batchId: string;
  qty: number;
  costPrice: number;
}

export interface Sale {
  id: string;
  itemId: string;
  size?: string;
  date: string;
  qty: number;
  sellingPrice: number;
  lines: SaleLine[];
  profit: number;
  returned: number;
}

export interface PriceChange {
  id: string;
  itemId: string;
  date: string;
  oldSelling: number;
  newSelling: number;
}

export interface Supplier {
  id: string;
  name: string;
  leadDays: number;
}

export interface EditLog {
  id: string;
  date: string;
  itemId: string;
  batchId?: string;
  field: string;
  oldValue: string;
  newValue: string;
  note?: string;
}

export interface AppState {
  items: Item[];
  batches: Batch[];
  sales: Sale[];
  priceChanges: PriceChange[];
  suppliers: Supplier[];
  today: string;
  editLog: EditLog[];
}
