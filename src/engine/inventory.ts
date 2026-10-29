import type { AppState, Item, Batch, Unit } from './types';

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function newItem(partial: Partial<Item> & Pick<Item, 'name' | 'unit' | 'sellingPrice' | 'isLoose'>): Item {
  return {
    id: uid(),
    source: 'market',
    ...partial,
  };
}

export function addItem(
  state: AppState,
  item: Item,
  openingQty: number,
  purchasePrice: number
): AppState {
  const items = [...state.items, item];
  let batches = state.batches;
  if (openingQty > 0) {
    const batch: Batch = {
      id: uid(),
      itemId: item.id,
      date: state.today,
      qtyBought: openingQty,
      qtyLeft: openingQty,
      purchasePrice,
      mrp: item.mrp,
    };
    batches = [...batches, batch];
  }
  return { ...state, items, batches };
}

export function cloneVariant(
  state: AppState,
  itemId: string,
  newName: string,
  newPrice?: number
): AppState {
  const base = state.items.find((i) => i.id === itemId);
  if (!base) return state;
  const clone: Item = {
    ...base,
    id: uid(),
    name: newName,
    sellingPrice: newPrice ?? base.sellingPrice,
  };
  return { ...state, items: [...state.items, clone] };
}

export function addSizeMatrix(
  state: AppState,
  baseItem: Item,
  sizes: string[],
  qtyPerSize: Record<string, number>,
  purchasePrice: number
): AppState {
  const item: Item = { ...baseItem, id: uid(), sizes };
  const batches: Batch[] = sizes.map((size) => ({
    id: uid(),
    itemId: item.id,
    size,
    date: state.today,
    qtyBought: qtyPerSize[size] ?? 0,
    qtyLeft: qtyPerSize[size] ?? 0,
    purchasePrice,
    mrp: item.mrp,
  }));
  return { ...state, items: [...state.items, item], batches: [...state.batches, ...batches] };
}

export interface ParsedBulkRow {
  name: string;
  qty: number;
  purchase: number;
  selling: number;
  mrp?: number;
  unit: Unit;
  isLoose: boolean;
}

export interface BulkParseResult {
  rows: ParsedBulkRow[];
  errors: string[];
  warnings: string[];
}

export function parseBulkLines(text: string): BulkParseResult {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: ParsedBulkRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  lines.forEach((line, idx) => {
    const parts = line.split(/[,\t]/).map((p) => p.trim());
    const name = parts[0];
    const qtyStr = parts[1] ?? '';
    const purchaseStr = parts[2] ?? '';
    const sellingStr = parts[3] ?? '';
    const mrpStr = parts[4] ?? '';

    if (!name) {
      errors.push(`Line ${idx + 1}: name missing`);
      return;
    }
    const qty = Number(qtyStr);
    if (qtyStr === '' || Number.isNaN(qty)) {
      errors.push(`Line ${idx + 1}: quantity missing or invalid`);
      return;
    }
    if (qty < 0) {
      errors.push(`Line ${idx + 1}: quantity cannot be negative`);
      return;
    }
    const purchase = Number(purchaseStr);
    if (purchaseStr === '' || Number.isNaN(purchase) || purchase <= 0) {
      errors.push(`Line ${idx + 1}: purchase price missing or invalid`);
      return;
    }
    const selling = Number(sellingStr);
    if (sellingStr === '' || Number.isNaN(selling) || selling <= 0) {
      errors.push(`Line ${idx + 1}: selling price missing`);
      return;
    }
    if (selling < purchase) {
      warnings.push(`Line ${idx + 1}: selling price below purchase price`);
    }
    const mrp = mrpStr ? Number(mrpStr) : undefined;
    if (mrpStr && (Number.isNaN(mrp!) || mrp! <= 0)) {
      errors.push(`Line ${idx + 1}: MRP invalid`);
      return;
    }
    rows.push({ name, qty, purchase, selling, mrp, unit: 'pc', isLoose: false });
  });

  return { rows, errors, warnings };
}

export function addBulk(state: AppState, rows: ParsedBulkRow[]): AppState {
  const items: Item[] = [];
  const batches: Batch[] = [];
  rows.forEach((r) => {
    const id = uid();
    items.push({
      id,
      name: r.name,
      unit: r.unit,
      mrp: r.mrp,
      sellingPrice: r.selling,
      isLoose: r.isLoose,
      source: 'market',
    });
    if (r.qty > 0) {
      batches.push({
        id: uid(),
        itemId: id,
        date: state.today,
        qtyBought: r.qty,
        qtyLeft: r.qty,
        purchasePrice: r.purchase,
        mrp: r.mrp,
      });
    }
  });
  return { ...state, items: [...state.items, ...items], batches: [...state.batches, ...batches] };
}

export function stockForItem(state: AppState, itemId: string): number {
  return state.batches
    .filter((b) => b.itemId === itemId)
    .reduce((sum, b) => sum + b.qtyLeft, 0);
}
