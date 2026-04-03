import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  MousePointer2, Square, Eraser, Loader2,
  CopyPlus, Files, Trash2, ListChecks, ChevronDown, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import type { ViewerTool } from '@/types/utilscraper';

interface ViewerToolbarProps {
  currentPage: number;
  totalPages: number;
  zoom: number;
  tool: ViewerTool;
  isOcr: boolean;
  hasHighlightsOnPage: boolean;
  onPageChange: (p: number) => void;
  onZoomChange: (z: number) => void;
  onToolChange: (t: ViewerTool) => void;
  onExtract: () => void;
  extracting: boolean;
  hasHighlights: boolean;
  // Bulk actions
  onApplyToAllPages: () => void;
  onApplyToAllPdfs: () => void;
  onEraseAllPages: () => void;
  onApplyToPageRange: (from: number, to: number) => void;
  searchOpen: boolean;
  onSearchToggle: () => void;
}

const ZOOM_OPTIONS = [
  { label: '50%',      value: 0.5  },
  { label: '75%',      value: 0.75 },
  { label: '100%',     value: 1.0  },
  { label: '125%',     value: 1.25 },
  { label: '150%',     value: 1.5  },
  { label: 'Fit Page', value: 0.8  },
];

export default function ViewerToolbar({
  currentPage, totalPages, zoom, tool, isOcr, hasHighlightsOnPage,
  onPageChange, onZoomChange, onToolChange,
  onExtract, extracting, hasHighlights,
  onApplyToAllPages, onApplyToAllPdfs, onEraseAllPages, onApplyToPageRange,
  searchOpen, onSearchToggle,
}: ViewerToolbarProps) {

  const toolBtn = (t: ViewerTool, icon: React.ReactNode, label: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`p-1.5 rounded transition-colors ${
            tool === t
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          onClick={() => onToolChange(t)}
          aria-label={label}
          aria-pressed={tool === t}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );

  const bulkBtn = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    disabled = false,
  ) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted
                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px] text-xs">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="h-10 bg-card border-b border-border flex items-center px-3 gap-2 shrink-0 overflow-x-auto">

      {/* Page navigation */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <input
          type="number"
          min={1}
          max={totalPages}
          className="w-10 h-7 text-center text-xs bg-muted rounded border-none text-foreground outline-none focus:ring-1 focus:ring-primary"
          value={currentPage}
          onChange={e => {
            const n = parseInt(e.target.value);
            if (!isNaN(n) && n >= 1 && n <= totalPages) onPageChange(n);
          }}
          aria-label="Current page"
        />

        <span className="text-xs text-muted-foreground px-1">/ {totalPages}</span>

        <button
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-border shrink-0" />

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => onZoomChange(Math.max(0.3, parseFloat((zoom - 0.15).toFixed(2))))}
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <Select value={String(zoom)} onValueChange={v => onZoomChange(Number(v))}>
          <SelectTrigger className="w-20 h-7 text-xs bg-muted border-none text-foreground focus:ring-0">
            <SelectValue>{Math.round(zoom * 100)}%</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ZOOM_OPTIONS.map(o => (
              <SelectItem key={o.label} value={String(o.value)}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => onZoomChange(Math.min(2.5, parseFloat((zoom + 0.15).toFixed(2))))}
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-border shrink-0" />

      {/* Drawing tools */}
      <div className="flex items-center gap-0.5 shrink-0">
        {toolBtn('cursor',    <MousePointer2 className="w-4 h-4" />, 'Cursor')}
        {toolBtn('highlight', <Square        className="w-4 h-4" />, 'Highlight — draw boxes')}
        {toolBtn('eraser',    <Eraser        className="w-4 h-4" />, 'Erase all on this page')}
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-border shrink-0" />

      {/* Bulk actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {bulkBtn(
          <CopyPlus className="w-4 h-4" />,
          'Copy highlights to all pages in this PDF',
          onApplyToAllPages,
          !hasHighlightsOnPage,
        )}
        {bulkBtn(
          <Files className="w-4 h-4" />,
          'Copy highlights to all open PDFs',
          onApplyToAllPdfs,
          !hasHighlightsOnPage,
        )}
        {bulkBtn(
          <Trash2 className="w-4 h-4" />,
          'Erase highlights from all pages in this PDF',
          onEraseAllPages,
          !hasHighlights,
        )}
        <PageRangeButton
          disabled={!hasHighlightsOnPage}
          totalPages={totalPages}
          onApply={onApplyToPageRange}
        />
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-border shrink-0" />

      {/* Search */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`p-1.5 rounded transition-colors shrink-0 ${
              searchOpen
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            onClick={onSearchToggle}
            aria-label="Search text (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Search text (Ctrl+F)</TooltipContent>
      </Tooltip>

      {/* Spacer */}
      <div className="flex-1" />

      {/* OCR badge */}
      {isOcr ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium cursor-default shrink-0">
              OCR Processed
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px] text-xs">
            Scanned page — text extracted via OCR
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground cursor-default shrink-0">
          Native Text
        </span>
      )}

      {/* Extract */}
      <Button
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs h-7 px-4 shrink-0"
        disabled={!hasHighlights || extracting}
        onClick={onExtract}
      >
        {extracting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
        Extract
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageRangeButton — uses fixed positioning so it escapes overflow:auto
// ---------------------------------------------------------------------------
function PageRangeButton({
  disabled,
  totalPages,
  onApply,
}: {
  disabled: boolean;
  totalPages: number;
  onApply: (from: number, to: number) => void;
}) {
  const [open, setOpen]           = useState(false);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo]     = useState('');
  const btnRef  = useRef<HTMLButtonElement>(null);
  const popRef  = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position the popover below the button using fixed coords
  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSubmit = () => {
    const from = parseInt(rangeFrom) || 1;
    const to   = parseInt(rangeTo)   || totalPages;
    onApply(Math.max(1, Math.min(from, totalPages)), Math.max(1, Math.min(to, totalPages)));
    setOpen(false);
    setRangeFrom('');
    setRangeTo('');
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={btnRef}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-0.5"
            onClick={() => setOpen(o => !o)}
            disabled={disabled}
            aria-label="Copy highlights to page range"
          >
            <ListChecks className="w-4 h-4" />
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Copy highlights to page range</TooltipContent>
      </Tooltip>

      {open && pos && (
        <div
          ref={popRef}
          className="fixed bg-card border border-border rounded-lg shadow-xl p-3 z-[100] w-56"
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="text-xs font-semibold text-foreground mb-2">Apply to page range</p>
          <div className="flex items-center gap-2 mb-2">
            <Input
              type="number"
              min={1}
              max={totalPages}
              placeholder="From"
              className="h-7 text-xs flex-1"
              value={rangeFrom}
              autoFocus
              onChange={e => setRangeFrom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="number"
              min={1}
              max={totalPages}
              placeholder="To"
              className="h-7 text-xs flex-1"
              value={rangeTo}
              onChange={e => setRangeTo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-xs"
              onClick={() => {
                setRangeFrom('1');
                setRangeTo(String(totalPages));
              }}
            >
              All pages
            </Button>
            <Button
              size="sm"
              className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSubmit}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
