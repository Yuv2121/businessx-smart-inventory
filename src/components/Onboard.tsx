import { useState } from 'react';
import MasterCatalog from './MasterCatalog';
import SizeMatrix from './SizeMatrix';
import LooseItem from './LooseItem';
import BulkPaste from './BulkPaste';
import type { AppState } from '@/engine/types';

interface Props {
  state: AppState;
  update: (s: AppState) => void;
}

const SUBTABS = ['Master Catalog', 'Size Matrix', 'Loose Item', 'Bulk Paste'] as const;

export default function Onboard({ state, update }: Props) {
  const [tab, setTab] = useState<typeof SUBTABS[number]>('Master Catalog');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-800">
        {SUBTABS.map((t) => (
          <button
            key={t}
            className={`px-3 py-2 text-sm whitespace-nowrap ${tab === t ? 'tab-active' : 'tab-inactive'}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Master Catalog' && <MasterCatalog state={state} update={update} />}
      {tab === 'Size Matrix' && <SizeMatrix state={state} update={update} />}
      {tab === 'Loose Item' && <LooseItem state={state} update={update} />}
      {tab === 'Bulk Paste' && <BulkPaste state={state} update={update} />}
    </div>
  );
}
