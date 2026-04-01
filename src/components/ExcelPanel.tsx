/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { X, Download, RefreshCw, Pencil, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ExtractedRow } from '@/types/utilscraper';
import { getFieldConfig } from '@/types/utilscraper';
import { exportToExcel } from '@/lib/excel-export';

interface Props {
  data: ExtractedRow[];
  filename: string;
  provider: string;
  onClose: () => void;
  onReExtract: () => void;
  onDataChange: (data: ExtractedRow[]) => void;
}

const CONF_PCT: Record<string, number> = { high: 95, medium: 65, low: 25 };

export default function ExcelPanel({ data, filename, provider, onClose, onReExtract, onDataChange }: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [sortCol, setSortCol]       = useState<string | null>(null);
  const [sortAsc, setSortAsc]       = useState(true);

  const sorted = [...data].sort((a, b) => {
    if (!sortCol) return 0;
    const av = String((a as any)[sortCol] ?? '');
    const bv = String((b as any)[sortCol] ?? '');
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const handleEdit = (rowIdx: number, value: string) => {
    const next    = [...data];
    const realIdx = data.indexOf(sorted[rowIdx]);
    next[realIdx] = { ...next[realIdx], value, edited: true };
    onDataChange(next);
    setEditingIdx(null);
  };

  const extracted  = data.filter(r => r.value).length;
  const nullCount  = data.filter(r => !r.value).length;

  return (
    <div className="h-full flex flex-col bg-[#f9fafb]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Extracted Data</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {extracted} value{extracted !== 1 ? 's' : ''} extracted
              {nullCount > 0 && <span className="text-amber-500 ml-1">· {nullCount} empty</span>}
            </p>
          </div>
          <button
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs border-gray-300 text-gray-600 hover:bg-gray-50"
            onClick={onReExtract}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Re-extract
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold"
            onClick={() => exportToExcel(data, filename, provider)}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export .xlsx
          </Button>
        </div>
      </div>

      {/* ── Column headers ─────────────────────────────────────────────── */}
      <div className="bg-[#1E3A5F] text-white text-[11px] font-semibold flex shrink-0">
        {['Page', 'Field', 'Value'].map(col => (
          <div
            key={col}
            className={`px-4 py-2.5 cursor-pointer hover:bg-white/10 select-none transition-colors
              ${col === 'Page' ? 'w-14 shrink-0' : col === 'Field' ? 'w-32 shrink-0' : 'flex-1'}`}
            onClick={() => handleSort(col.toLowerCase())}
          >
            {col} {sortCol === col.toLowerCase() ? (sortAsc ? '↑' : '↓') : ''}
          </div>
        ))}
      </div>

      {/* ── Rows ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-sm text-gray-500">No values extracted yet.</p>
            <p className="text-xs text-gray-400">Draw highlight boxes over bill values then click Extract.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sorted.map((row, i) => {
              const isNull  = row.value === null || row.value === undefined;
              const cfg     = getFieldConfig(row.field);
              const pct     = CONF_PCT[row.confidence ?? 'low'] ?? 25;
              const pctColor = pct >= 90 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';

              return (
                <div
                  key={i}
                  className={`group/row flex items-stretch text-xs transition-colors
                    ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}
                    ${isNull ? 'border-l-2 border-l-red-300' : ''}
                    ${row.edited ? 'border-l-2 border-l-amber-400' : ''}
                    hover:bg-green-50/40`}
                >
                  {/* Page */}
                  <div className="w-14 shrink-0 px-4 py-3 text-gray-400 font-medium flex items-center">
                    {row.page}
                  </div>

                  {/* Field */}
                  <div className="w-32 shrink-0 px-3 py-3 flex items-center">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                      <span className="text-gray-700 font-medium truncate">{cfg.label}</span>
                    </span>
                  </div>

                  {/* Value */}
                  <div
                    className="flex-1 px-3 py-3 flex items-center cursor-text"
                    onDoubleClick={() => setEditingIdx(i)}
                    title="Double-click to edit"
                  >
                    {editingIdx === i ? (
                      <input
                        className="w-full bg-white border border-green-400 rounded px-2 py-1 text-xs outline-none shadow-sm"
                        defaultValue={row.value || ''}
                        autoFocus
                        onBlur={e => handleEdit(i, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleEdit(i, (e.target as HTMLInputElement).value);
                          if (e.key === 'Escape') setEditingIdx(null);
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-2 w-full min-w-0">
                        {isNull ? (
                          <span className="text-gray-300 italic">—</span>
                        ) : (
                          <span className={`truncate ${row.edited ? 'text-amber-700' : 'text-gray-800'}`}>
                            {row.value}
                          </span>
                        )}

                        <div className="ml-auto flex items-center gap-1.5 shrink-0">
                          {/* Accuracy — hidden by default, shown on row hover */}
                          {!isNull && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help opacity-0 group-hover/row:opacity-100 transition-opacity">
                                  <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${pct}%`, backgroundColor: pctColor }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-semibold" style={{ color: pctColor }}>
                                    {pct}%
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs">
                                <div className="space-y-1">
                                  <div>{pct >= 90 ? 'High' : pct >= 60 ? 'Medium' : 'Low'} accuracy</div>
                                  {row.wasOcr && <div className="text-amber-300">🔍 OCR extracted</div>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {row.edited && <Pencil className="w-3 h-3 text-amber-500" />}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer summary ─────────────────────────────────────────────── */}
      {data.length > 0 && (
        <div className="bg-white border-t border-gray-200 px-5 py-2.5 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>{data.length} row{data.length !== 1 ? 's' : ''} · double-click any value to edit</span>
            <span className="text-green-600 font-medium">{extracted} extracted</span>
          </div>
        </div>
      )}
    </div>
  );
}