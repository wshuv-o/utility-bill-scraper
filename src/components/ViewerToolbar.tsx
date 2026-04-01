import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MousePointer2, Square, Eraser, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ViewerTool } from '@/types/utilscraper';

interface ViewerToolbarProps {
  currentPage: number;
  totalPages: number;
  zoom: number;
  tool: ViewerTool;
  isOcr: boolean;
  onPageChange: (p: number) => void;
  onZoomChange: (z: number) => void;
  onToolChange: (t: ViewerTool) => void;
  onExtract: () => void;
  extracting: boolean;
  hasHighlights: boolean;
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
  currentPage, totalPages, zoom, tool, isOcr,
  onPageChange, onZoomChange, onToolChange,
  onExtract, extracting, hasHighlights,
}: ViewerToolbarProps) {

  const toolBtn = (t: ViewerTool, icon: React.ReactNode, label: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`p-1.5 rounded transition-colors ${
            tool === t
              ? 'bg-green-100 text-green-700'
              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
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

  return (
    <div className="h-10 bg-white border-b border-gray-200 flex items-center px-3 gap-2 shrink-0 overflow-x-auto">

      {/* Page navigation */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 transition-colors"
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
          className="w-10 h-7 text-center text-xs bg-gray-100 rounded border-none text-gray-700 outline-none focus:ring-1 focus:ring-green-400"
          value={currentPage}
          onChange={e => {
            const n = parseInt(e.target.value);
            if (!isNaN(n) && n >= 1 && n <= totalPages) onPageChange(n);
          }}
          aria-label="Current page"
        />

        <span className="text-xs text-gray-400 px-1">/ {totalPages}</span>

        <button
          className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 transition-colors"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-gray-200 shrink-0" />

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          onClick={() => onZoomChange(Math.max(0.3, parseFloat((zoom - 0.15).toFixed(2))))}
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <Select value={String(zoom)} onValueChange={v => onZoomChange(Number(v))}>
          <SelectTrigger className="w-20 h-7 text-xs bg-gray-100 border-none text-gray-700 focus:ring-0">
            <SelectValue>{Math.round(zoom * 100)}%</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ZOOM_OPTIONS.map(o => (
              <SelectItem key={o.label} value={String(o.value)}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          onClick={() => onZoomChange(Math.min(2.5, parseFloat((zoom + 0.15).toFixed(2))))}
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-gray-200 shrink-0" />

      {/* Drawing tools */}
      <div className="flex items-center gap-0.5 shrink-0">
        {toolBtn('cursor',    <MousePointer2 className="w-4 h-4" />, 'Cursor')}
        {toolBtn('highlight', <Square        className="w-4 h-4" />, 'Highlight — draw boxes')}
        {toolBtn('eraser',    <Eraser        className="w-4 h-4" />, 'Erase all on this page')}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* OCR badge */}
      {isOcr ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium cursor-default shrink-0">
              🔍 OCR Processed
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px] text-xs">
            Scanned page — text extracted via OCR
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 cursor-default shrink-0">
          📄 Native Text
        </span>
      )}

      {/* Extract */}
      <Button
        size="sm"
        className="bg-green-600 text-white hover:bg-green-700 font-semibold text-xs h-7 px-4 shrink-0"
        disabled={!hasHighlights || extracting}
        onClick={onExtract}
      >
        {extracting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
        Extract
      </Button>
    </div>
  );
}