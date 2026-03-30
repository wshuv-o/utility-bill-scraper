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
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

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
    const next = [...data];
    const realIdx = data.indexOf(sorted[rowIdx]);
    next[realIdx] = { ...next[realIdx], value, edited: true };
    onDataChange(next);
    setEditingCell(null);
  };

  return (
    <div className="h-full flex flex-col border-l border-border bg-card animate-slide-in-right">
      {/* Header */}
      <div className="h-11 flex items-center justify-between px-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Extracted Data</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{data.length} rows</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onReExtract}>
            <RefreshCw className="w-3 h-3 mr-1" /> Re-extract
          </Button>
          <Button size="sm" className="h-7 text-xs bg-success text-success-foreground hover:bg-success/90" onClick={() => exportToExcel(data, filename, provider)}>
            <Download className="w-3 h-3 mr-1" /> Export .xlsx
          </Button>
          <button className="p-1 text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Comment */}
      <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-border">
        {/* TODO: Excel template upload — user will provide a .xlsx template and extracted values will be mapped into its cells accordingly */}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No values were extracted. Go back and draw highlight boxes over the bill values.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-primary text-primary-foreground">
                {columns.map(col => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-semibold cursor-pointer hover:bg-primary/80 select-none capitalize"
                    onClick={() => handleSort(col)}
                  >
                    {col} {sortCol === col ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const isNull = row.value === null || row.value === undefined;
                return (
                  <tr key={i} className={`border-b border-border ${i % 2 === 0 ? 'bg-card' : 'bg-accent/5'}`}>
                    <td className="px-3 py-2 text-muted-foreground">{row.page}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getFieldConfig(row.field as any).color }} />
                        {getFieldConfig(row.field as any).label}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 relative ${isNull ? 'bg-destructive/10' : ''} ${row.edited ? 'bg-warning/10' : ''}`}
                      onDoubleClick={() => setEditingCell({ row: i, col: 'value' })}
                    >
                      {editingCell?.row === i && editingCell?.col === 'value' ? (
                        <input
                          className="w-full bg-card border border-accent rounded px-1 py-0.5 text-xs outline-none"
                          defaultValue={row.value || ''}
                          autoFocus
                          onBlur={e => handleEdit(i, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleEdit(i, (e.target as HTMLInputElement).value); }}
                        />
                      ) : (
                        <span className="flex items-center gap-1">
                          {isNull ? <span className="text-muted-foreground">—</span> : row.value}
                          {row.wasOcr && (
                            <Tooltip>
                              <TooltipTrigger><span className="text-warning">●</span></TooltipTrigger>
                              <TooltipContent className="text-xs">Extracted via OCR — verify accuracy</TooltipContent>
                            </Tooltip>
                          )}
                          {row.edited && <Pencil className="w-3 h-3 text-warning" />}
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
