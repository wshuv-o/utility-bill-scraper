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
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {highlights.filter(h => h.width > 0 && h.height > 0).map(h => {
        const cfg = getFieldConfig(h.field);

        // extractedValue can be null (not found) or a string (found) or undefined (not yet extracted)
        const hasResult  = h.extractedValue !== undefined;
        const hasValue   = hasResult && h.extractedValue !== null && h.extractedValue !== '';
        const statusIcon = hasResult
          ? (hasValue ? (h.wasOcr ? '🟡' : '✅') : '❌')
          : null;

        // If highlight is near the top of the page, show label below instead of above
        const labelBelow = h.y < 0.06;

        return (
          <div
            key={h.id}
            // Only enable pointer-events when cursor tool is active (allows deletion)
            // In highlight tool mode, mouse events pass through to draw new boxes
            className={`absolute group ${tool === 'cursor' ? 'pointer-events-auto' : 'pointer-events-none'}`}
            style={{
              left:            `${h.x * 100}%`,
              top:             `${h.y * 100}%`,
              width:           `${h.width * 100}%`,
              height:          `${h.height * 100}%`,
              backgroundColor: cfg.bgColor,
              // Dashed border for approximate OCR highlights, solid for exact
              border:          `2px ${h.isAutoExtracted && h.wasOcr ? 'dashed' : 'solid'} ${cfg.color}`,
              borderRadius:    3,
              zIndex:          10,
              opacity:         h.isAutoExtracted && h.wasOcr ? 0.75 : 1,
            }}
          >
            {/* Field label tag + accuracy tooltip on hover */}
            <span
              className="absolute left-0 text-[10px] font-medium px-1.5 py-0.5 rounded-sm whitespace-nowrap select-none z-20"
              style={{
                backgroundColor: cfg.color,
                color:           '#ffffff',
                ...(labelBelow
                  ? { top: 'calc(100% + 2px)' }
                  : { bottom: 'calc(100% + 2px)' }
                ),
              }}
            >
              {cfg.label}
            </span>

            {/* Extraction status icon */}
            {statusIcon && (
              <span
                className="absolute text-xs select-none z-20"
                style={{
                  ...(labelBelow
                    ? { top: 'calc(100% + 2px)', right: 20 }
                    : { bottom: 'calc(100% + 2px)', right: 20 }
                  ),
                }}
              >
                {statusIcon}
              </span>
            )}

            {/* Hover tooltip — shows extracted value + OCR confidence */}
            {hasValue && (
              <div
                className="absolute left-0 z-50 hidden group-hover:flex flex-col gap-1
                           bg-gray-900 text-white text-[11px] rounded-md shadow-xl
                           px-2.5 py-2 min-w-[160px] max-w-[260px] pointer-events-none"
                style={{
                  ...(labelBelow
                    ? { top: 'calc(100% + 22px)' }
                    : { bottom: 'calc(100% + 22px)' }
                  ),
                }}
              >
                {/* Extracted value */}
                <span className="font-semibold text-white truncate">
                  {h.extractedValue}
                </span>
                {/* Accuracy bar */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: h.confidence === 'high' ? '100%'
                             : h.confidence === 'medium' ? '60%' : '25%',
                        backgroundColor: h.confidence === 'high' ? '#22c55e'
                                       : h.confidence === 'medium' ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-medium shrink-0"
                    style={{
                      color: h.confidence === 'high' ? '#86efac'
                           : h.confidence === 'medium' ? '#fcd34d' : '#fca5a5',
                    }}
                  >
                    {h.confidence === 'high' ? 'High' : h.confidence === 'medium' ? 'Medium' : 'Low'}
                    {' accuracy'}
                  </span>
                </div>
                {/* OCR badge */}
                {h.wasOcr && (
                  <span className="text-[10px] text-amber-300 mt-0.5">🔍 OCR extracted</span>
                )}
              </div>
            )}

            {/* Delete button — always inside the highlight box, top-right corner */}
            {tool === 'cursor' && (
              <button
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full
                           flex items-center justify-center
                           opacity-0 group-hover:opacity-100 transition-opacity
                           pointer-events-auto z-30"
                style={{ backgroundColor: cfg.color }}
                onClick={e => { e.stopPropagation(); onDelete(h.id); }}
                title={`Remove ${cfg.label} highlight`}
              >
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            )}
          </div>
        );
      })}

      {/* Live drawing box while user drags */}
      {drawing && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            left:         `${drawing.x * 100}%`,
            top:          `${drawing.y * 100}%`,
            width:        `${drawing.w * 100}%`,
            height:       `${drawing.h * 100}%`,
            border:       '2px dashed #2563eb',
            borderRadius: 3,
            backgroundColor: 'rgba(37,99,235,0.08)',
            // Animated dashes
            animation:    'dashMove 0.4s linear infinite',
          }}
        />
      )}

      {/* Dash animation keyframes injected once */}
      <style>{`
        @keyframes dashMove {
          to { stroke-dashoffset: -10; }
        }
      `}</style>
    </div>
  );
}