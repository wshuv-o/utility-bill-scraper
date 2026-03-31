import { FileText, ChevronRight, Loader2, Check } from 'lucide-react';
import type { PDFSession } from '@/types/utilscraper';

interface PDFCardListProps {
  sessions: PDFSession[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}

function StatusBadge({ session }: { session: PDFSession }) {
  // Guard: pages may not be populated yet during upload/processing
  const ocrCount = Array.isArray(session.pages)
    ? session.pages.filter(p => p.is_ocr).length
    : 0;

  switch (session.status) {
    case 'uploading':
      return (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Uploading...
        </span>
      );

    case 'processing':
      return (
        <span className="flex items-center gap-1.5 text-xs text-blue-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Analysing pages...
        </span>
      );

    case 'ready':
      return (
        <span className="flex items-center gap-2 flex-wrap">
          {ocrCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              {ocrCount} page{ocrCount !== 1 ? 's' : ''} OCR'd
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            Ready to highlight
          </span>
        </span>
      );

    case 'extracted':
      return (
        <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
          <Check className="w-3 h-3" />
          Extracted
        </span>
      );

    default:
      return null;
  }
}

export default function PDFCardList({ sessions, expandedId, onToggle }: PDFCardListProps) {
  if (!sessions.length) return null;

  return (
    <div className="space-y-2">
      {sessions.map(s => {
        const expanded   = expandedId === s.id;
        const isLoading  = s.status === 'uploading' || s.status === 'processing';

        return (
          // Use div + role="button" instead of <button> to avoid
          // invalid nesting of block elements (<p> etc.) inside <button>
          <div
            key={s.id}
            role="button"
            tabIndex={isLoading ? -1 : 0}
            aria-expanded={expanded}
            aria-disabled={isLoading}
            className={[
              'w-full text-left rounded-lg border p-3 flex items-center gap-3 transition-colors',
              isLoading
                ? 'border-border bg-card opacity-60 cursor-not-allowed'
                : expanded
                  ? 'border-blue-500 bg-blue-50/50 cursor-pointer'
                  : 'border-border bg-card hover:border-blue-400 cursor-pointer',
            ].join(' ')}
            onClick={() => !isLoading && onToggle(s.id)}
            onKeyDown={e => {
              if (!isLoading && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onToggle(s.id);
              }
            }}
          >
            <FileText className="w-5 h-5 text-muted-foreground shrink-0" />

            <div className="flex-1 min-w-0">
              <span className="block text-sm font-semibold truncate max-w-[30ch]">
                {s.filename}
              </span>
              <div className="mt-0.5">
                <StatusBadge session={s} />
              </div>
            </div>

            {s.total_pages > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                {s.total_pages} page{s.total_pages !== 1 ? 's' : ''}
              </span>
            )}

            <ChevronRight
              className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                expanded ? 'rotate-90' : ''
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}