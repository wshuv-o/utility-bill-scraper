import { X } from 'lucide-react';
import type { Highlight, ViewerTool } from '@/types/utilscraper';
import { getFieldConfig } from '@/types/utilscraper';

interface Props {
  highlights: Highlight[];
  drawing: { x: number; y: number; w: number; h: number } | null;
  onDelete: (id: string) => void;
  tool: ViewerTool;
}

export default function HighlightOverlay({ highlights, drawing, onDelete, tool }: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {highlights.map(h => {
        const cfg = getFieldConfig(h.field);
        const statusIcon = h.extractedValue !== undefined
          ? (h.extractedValue ? (h.wasOcr ? '🟡' : '✅') : '❌')
          : null;
        return (
          <div
            key={h.id}
            className="absolute group pointer-events-auto"
            style={{
              left: `${h.x * 100}%`,
              top: `${h.y * 100}%`,
              width: `${h.width * 100}%`,
              height: `${h.height * 100}%`,
              backgroundColor: cfg.bgColor,
              border: `2px solid ${cfg.color}`,
              borderRadius: 3,
            }}
          >
            <span
              className="absolute -top-5 left-0 text-[10px] font-medium px-1.5 py-0.5 rounded-sm text-accent-foreground whitespace-nowrap"
              style={{ backgroundColor: cfg.color }}
            >
              {cfg.label}
            </span>
            {statusIcon && (
              <span className="absolute -top-5 right-5 text-xs">{statusIcon}</span>
            )}
            <button
              className="absolute -top-5 -right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
              style={{ backgroundColor: cfg.color }}
              onClick={(e) => { e.stopPropagation(); onDelete(h.id); }}
            >
              <X className="w-2.5 h-2.5 text-accent-foreground" />
            </button>
          </div>
        );
      })}

      {drawing && (
        <div
          className="absolute border-2 border-dashed border-accent highlight-drawing"
          style={{
            left: `${drawing.x * 100}%`,
            top: `${drawing.y * 100}%`,
            width: `${drawing.w * 100}%`,
            height: `${drawing.h * 100}%`,
          }}
        />
      )}
    </div>
  );
}
