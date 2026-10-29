import { useState } from 'react';
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { AppState } from '@/engine/types';
import { parseBulkLines, addBulk, type ParsedBulkRow } from '@/engine/inventory';

interface Props {
  state: AppState;
  update: (s: AppState) => void;
}

export default function BulkPaste({ state, update }: Props) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<{ rows: ParsedBulkRow[]; errors: string[]; warnings: string[] } | null>(null);

  function doPreview() {
    setPreview(parseBulkLines(text));
  }

  function addValid() {
    if (!preview) return;
    update(addBulk(state, preview.rows));
    setText('');
    setPreview(null);
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-zinc-500">
        Format: <code className="text-zinc-400">Name, qty, purchase, selling, mrp(optional)</code> — comma or tab separated, one per line.
      </div>

      <textarea
        className="input-field w-full h-40 font-mono text-xs resize-y"
        placeholder={'Fortune Oil 1L, 10, 118, 132, 140\nAashirvaad Atta 5kg, 5, 290, 305, 320\nTata Salt 1kg, 20, 22, 26'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button className="btn-primary w-full" onClick={doPreview} disabled={!text.trim()}>
        <span className="inline-flex items-center gap-2"><Upload size={16} /> Preview</span>
      </button>

      {preview && (
        <div className="space-y-3">
          {preview.errors.length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-1">
              {preview.errors.map((e, i) => (
                <div key={i} className="text-xs text-red-400 flex items-center gap-2"><AlertTriangle size={12} /> {e}</div>
              ))}
            </div>
          )}
          {preview.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
              {preview.warnings.map((w, i) => (
                <div key={i} className="text-xs text-amber-400">{w}</div>
              ))}
            </div>
          )}
          {preview.rows.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-900 text-zinc-500">
                    <tr>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-right px-3 py-2">Buy</th>
                      <th className="text-right px-3 py-2">Sell</th>
                      <th className="text-right px-3 py-2">MRP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, i) => (
                      <tr key={i} className="border-t border-zinc-800/60">
                        <td className="px-3 py-2 text-zinc-200">{r.name}</td>
                        <td className="px-3 py-2 text-right text-zinc-300">{r.qty}</td>
                        <td className="px-3 py-2 text-right text-zinc-300">₹{r.purchase}</td>
                        <td className="px-3 py-2 text-right text-zinc-300">₹{r.selling}</td>
                        <td className="px-3 py-2 text-right text-zinc-500">{r.mrp ? `₹${r.mrp}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn-primary w-full" onClick={addValid}>
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} /> Add {preview.rows.length} valid row{preview.rows.length > 1 ? 's' : ''}</span>
              </button>
            </>
          )}
          {preview.rows.length === 0 && preview.errors.length > 0 && (
            <div className="text-xs text-zinc-500">No valid rows to add. Fix the errors above and preview again.</div>
          )}
        </div>
      )}
    </div>
  );
}
