import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MousePointer2, Square, Eraser, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  onAutoExtract: () => void;
  extracting: boolean;
  hasHighlights: boolean;
}

// zoom=1.0 → 100% scale (matches PDFViewer scale={zoom})
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
  onExtract, onAutoExtract, extracting, hasHighlights,
}: ViewerToolbarProps) {

  const toolBtn = (t: ViewerTool, icon: React.ReactNode, label: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`p-1.5 rounded transition-colors ${
            tool === t
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/10'
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
    <div className="h-11 bg-[#323232] flex items-center px-3 gap-2 shrink-0">

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <button
          className="p-1 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <Input
          className="w-10 h-7 text-center text-xs bg-white/10 border-none text-white p-0"
          value={currentPage}
          onChange={e => {
            const n = parseInt(e.target.value);
            if (!isNaN(n) && n >= 1 && n <= totalPages) onPageChange(n);
          }}
          aria-label="Current page"
        />

        <span className="text-xs text-white/50">/ {totalPages}</span>

        <button
          className="p-1 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 ml-3">
        <button
          className="p-1 text-white/60 hover:text-white transition-colors"
          onClick={() => onZoomChange(Math.max(0.3, parseFloat((zoom - 0.15).toFixed(2))))}
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <Select value={String(zoom)} onValueChange={v => onZoomChange(Number(v))}>
          <SelectTrigger className="w-20 h-7 text-xs bg-white/10 border-none text-white">
            {/* Display current zoom as percentage */}
            <SelectValue>{Math.round(zoom * 100)}%</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ZOOM_OPTIONS.map(o => (
              <SelectItem key={o.label} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          className="p-1 text-white/60 hover:text-white transition-colors"
          onClick={() => onZoomChange(Math.min(2.5, parseFloat((zoom + 0.15).toFixed(2))))}
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-white/20 mx-2" />

      {/* Drawing tools */}
      {toolBtn('cursor',    <MousePointer2 className="w-4 h-4" />, 'Cursor')}
      {toolBtn('highlight', <Square        className="w-4 h-4" />, 'Highlight tool — draw boxes')}
      {toolBtn('eraser',    <Eraser        className="w-4 h-4" />, 'Erase all highlights on this page')}

      {/* Spacer */}
      <div className="flex-1" />

      {/* OCR status badge */}
      {isOcr ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium cursor-default">
              🔍 OCR Processed
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-xs">
            This page was a scanned image. Text was extracted automatically using OCR.
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 cursor-default">
          📄 Native Text
        </span>
      )}

      {/* Auto-Extract button */}
      <Button
        size="sm"
        variant="outline"
        className="ml-2 font-semibold text-xs h-8 px-3 border-blue-400/40 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200 bg-transparent"
        disabled={extracting}
        onClick={onAutoExtract}
      >
        {extracting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
        ⚡ Auto-Extract
      </Button>

      {/* Manual Extract button */}
      <Button
        size="sm"
        className="bg-blue-600 text-white hover:bg-blue-700 font-semibold text-xs h-8 px-4"
        disabled={!hasHighlights || extracting}
        onClick={onExtract}
      >
        {extracting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
        Extract
      </Button>
    </div>
  );
}