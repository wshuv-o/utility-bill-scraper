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

const ZOOM_OPTIONS = [
  { label: '50%', value: 0.5 / 1.5 },
  { label: '75%', value: 0.75 / 1.5 },
  { label: '100%', value: 1 / 1.5 },
  { label: '125%', value: 1.25 / 1.5 },
  { label: '150%', value: 1 },
  { label: 'Fit Page', value: 0.6 },
];

export default function ViewerToolbar({
  currentPage, totalPages, zoom, tool, isOcr,
  onPageChange, onZoomChange, onToolChange, onExtract, onAutoExtract, extracting, hasHighlights,
}: ViewerToolbarProps) {
  const toolBtn = (t: ViewerTool, icon: React.ReactNode, label: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`p-1.5 rounded transition-colors ${tool === t ? 'bg-accent/30 text-accent' : 'text-primary-foreground/70 hover:text-primary-foreground'}`}
          onClick={() => onToolChange(t)}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="h-11 bg-toolbar flex items-center px-3 gap-2 shrink-0">
      {/* Page nav */}
      <div className="flex items-center gap-1">
        <button className="p-1 text-primary-foreground/70 hover:text-primary-foreground disabled:opacity-30" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Input
          className="w-10 h-7 text-center text-xs bg-foreground/10 border-none text-primary-foreground p-0"
          value={currentPage}
          onChange={e => {
            const n = parseInt(e.target.value);
            if (n >= 1 && n <= totalPages) onPageChange(n);
          }}
        />
        <span className="text-xs text-primary-foreground/60">/ {totalPages}</span>
        <button className="p-1 text-primary-foreground/70 hover:text-primary-foreground disabled:opacity-30" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-1 ml-3">
        <button className="p-1 text-primary-foreground/70 hover:text-primary-foreground" onClick={() => onZoomChange(Math.max(0.3, zoom - 0.15))}>
          <ZoomOut className="w-4 h-4" />
        </button>
        <Select value={String(zoom)} onValueChange={v => onZoomChange(Number(v))}>
          <SelectTrigger className="w-20 h-7 text-xs bg-foreground/10 border-none text-primary-foreground">
            <SelectValue>{Math.round(zoom * 150)}%</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ZOOM_OPTIONS.map(o => (
              <SelectItem key={o.label} value={String(o.value)}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button className="p-1 text-primary-foreground/70 hover:text-primary-foreground" onClick={() => onZoomChange(Math.min(2, zoom + 0.15))}>
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-primary-foreground/20 mx-2" />

      {/* Tools */}
      {toolBtn('cursor', <MousePointer2 className="w-4 h-4" />, 'Cursor')}
      {toolBtn('highlight', <Square className="w-4 h-4" />, 'Highlight')}
      {toolBtn('eraser', <Eraser className="w-4 h-4" />, 'Erase all')}

      {/* Spacer */}
      <div className="flex-1" />

      {/* OCR badge */}
      {isOcr ? (
        <Tooltip>
          <TooltipTrigger>
            <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">🔍 OCR Processed</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-xs">
            This page was a scanned image. Text was extracted using OCR automatically.
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-foreground/10 text-primary-foreground/60">📄 Native Text</span>
      )}

      {/* Auto Extract */}
      <Button
        size="sm"
        variant="outline"
        className="ml-2 font-semibold text-xs h-8 px-3 border-accent/40 text-accent hover:bg-accent/10"
        disabled={extracting}
        onClick={onAutoExtract}
      >
        {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
        ⚡ Auto-Extract
      </Button>

      {/* Manual Extract */}
      <Button
        size="sm"
        className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-xs h-8 px-4"
        disabled={!hasHighlights || extracting}
        onClick={onExtract}
      >
        {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
        Extract
      </Button>
    </div>
  );
}
