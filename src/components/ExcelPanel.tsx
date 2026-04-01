/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { X, Download, RefreshCw, Pencil } from 'lucide-react';
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

export default function ExcelPanel({ data, filename, provider, onClose, onReExtract, onDataChange }: Props) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [sortCol, setSortCol]         = useState<string | null>(null);
  const [sortAsc, setSortAsc]         = useState(true);

  const columns = ['page', 'field', 'value'];

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
    setEditingCell(null);
  };

  return (
    <div className="h-full flex flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="h-11 flex items-center justify-between px-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Extracted Data</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            {data.length} row{data.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onReExtract}>
            <RefreshCw className="w-3 h-3 mr-1" /> Re-extract
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-green-600 text-white hover:bg-green-700"
            onClick={() => exportToExcel(data, filename, provider)}
          >
            <Download className="w-3 h-3 mr-1" /> Export .xlsx
          </Button>
          <button
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground px-4 text-center">
            No values extracted yet. Draw highlight boxes over the bill values then click Extract.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#1E3A5F] text-white">
                {columns.map(col => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-semibold cursor-pointer hover:bg-white/10 select-none capitalize"
                    onClick={() => handleSort(col)}
                  >
                    {col} {sortCol === col ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const isNull  = row.value === null || row.value === undefined;
                const cfg     = getFieldConfig(row.field);
                return (
                  <tr
                    key={i}
                    className={`border-b border-border ${i % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}
                  >
                    {/* Page */}
                    <td className="px-3 py-2 text-muted-foreground">{row.page}</td>

                    {/* Field */}
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cfg.color }}
                        />
                        {cfg.label}
                      </span>
                    </td>

                    {/* Value — double-click to edit */}
                    <td
                      className={`px-3 py-2 relative cursor-text ${
                        isNull   ? 'bg-red-50'    :
                        row.edited ? 'bg-amber-50' : ''
                      }`}
                      onDoubleClick={() => setEditingCell({ row: i, col: 'value' })}
                      title="Double-click to edit"
                    >
                      {editingCell?.row === i && editingCell?.col === 'value' ? (
                        <input
                          className="w-full bg-white border border-blue-400 rounded px-1 py-0.5 text-xs outline-none"
                          defaultValue={row.value || ''}
                          autoFocus
                          onBlur={e => handleEdit(i, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleEdit(i, (e.target as HTMLInputElement).value);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                        />
                      ) : (
                        <span className="flex items-center gap-1">
                          {isNull
                            ? <span className="text-muted-foreground italic">—</span>
                            : <span className={row.edited ? 'text-amber-700' : ''}>{row.value}</span>
                          }
                          {row.wasOcr && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-amber-500 cursor-help">●</span>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs max-w-[180px]">
                                <div className="flex flex-col gap-1">
                                  <span>OCR extracted — verify accuracy</span>
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: row.confidence === 'high' ? '95%' : row.confidence === 'medium' ? '65%' : '25%',
                                          backgroundColor: row.confidence === 'high' ? '#22c55e' : row.confidence === 'medium' ? '#f59e0b' : '#ef4444',
                                        }}
                                      />
                                    </div>
                                    <span className="font-bold shrink-0" style={{
                                      color: row.confidence === 'high' ? '#22c55e' : row.confidence === 'medium' ? '#f59e0b' : '#ef4444',
                                    }}>
                                      {row.confidence === 'high' ? '95%' : row.confidence === 'medium' ? '65%' : '25%'}
                                    </span>
                                  </div>
                                  <span className="text-white/60">
                                    {row.confidence === 'high' ? 'High' : row.confidence === 'medium' ? 'Medium' : 'Low'} accuracy
                                  </span>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {row.edited && (
                            <Pencil className="w-3 h-3 text-amber-500 shrink-0" />
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}