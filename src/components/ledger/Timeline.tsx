import { useState } from 'react';
import { Package, Tag, ShoppingCart, Undo, Pencil, Filter } from 'lucide-react';
import type { AppState } from '@/engine/types';
import { getTimeline, type TimelineType, type TimelineEntry } from '@/engine/fifo';

interface Props {
  state: AppState;
  itemId: string;
}

const CHIPS: { label: string; types: TimelineType[] | null }[] = [
  { label: 'All', types: null },
  { label: 'Stock', types: ['STOCK_ADDED'] },
  { label: 'Prices', types: ['PRICE_CHANGED'] },
  { label: 'Sales', types: ['SALE', 'RETURN'] },
  { label: 'Edits', types: ['EDIT'] },
];

function fmtDate(d: string): string {
  const dt = new Date(d);
  return `${dt.getDate()} ${dt.toLocaleString('en-IN', { month: 'short' })} ${dt.getFullYear()}`;
}

function iconFor(type: TimelineType) {
  switch (type) {
    case 'STOCK_ADDED': return <Package size={14} className="text-emerald-400" />;
    case 'PRICE_CHANGED': return <Tag size={14} className="text-amber-400" />;
    case 'SALE': return <ShoppingCart size={14} className="text-pink-400" />;
    case 'RETURN': return <Undo size={14} className="text-blue-400" />;
    case 'EDIT': return <Pencil size={14} className="text-zinc-400" />;
  }
}

export default function Timeline({ state, itemId }: Props) {
  const [filter, setFilter] = useState<typeof CHIPS[number] | null>(null);

  let entries: TimelineEntry[] = getTimeline(state, itemId);
  if (filter?.types) {
    entries = entries.filter((e) => filter.types!.includes(e.type));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={12} className="text-zinc-600" />
        {CHIPS.map((c) => (
          <button
            key={c.label}
            className={`text-xs px-2.5 py-1 rounded-full border ${filter?.label === c.label ? 'border-pink-500/40 text-pink-400 bg-pink-500/10' : 'border-zinc-800 text-zinc-500'}`}
            onClick={() => setFilter(filter?.label === c.label ? null : c)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="text-sm text-zinc-600 text-center py-6">No events yet.</div>
      ) : (
        <div className="space-y-0">
          {entries.map((entry, i) => (
            <div key={i} className="flex gap-3 py-2.5 border-b border-zinc-800/40 last:border-0">
              <div className="shrink-0 mt-0.5">{iconFor(entry.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-500">{fmtDate(entry.date)}</div>
                <div className="text-sm text-zinc-300">{entry.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
