import { FileText, ChevronRight, Loader2, Check } from 'lucide-react';
import type { PDFSession } from '@/types/utilscraper';

interface PDFCardListProps {
  sessions: PDFSession[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}

function statusBadge(session: PDFSession) {
  const ocrCount = session.pages.filter(p => p.is_ocr).length;

  switch (session.status) {
    case 'uploading':
      return <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span>;
    case 'processing':
      return <span className="flex items-center gap-1.5 text-xs text-accent"><Loader2 className="w-3 h-3 animate-spin" /> Analysing pages...</span>;
    case 'ready':
      return (
        <span className="flex items-center gap-2">
          {ocrCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">{ocrCount} pages OCR'd</span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">Ready to highlight</span>
        </span>
      );
    case 'extracted':
      return <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-success/15 text-success font-medium"><Check className="w-3 h-3" /> Extracted</span>;
  }
}

export default function PDFCardList({ sessions, expandedId, onToggle }: PDFCardListProps) {
  if (!sessions.length) return null;

  return (
    <div className="space-y-2">
      {sessions.map(s => {
        const expanded = expandedId === s.id;
        return (
          <button
            key={s.id}
            className={`w-full text-left rounded-lg border p-3 flex items-center gap-3 transition-colors cursor-pointer ${
              expanded ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/40'
            }`}
            onClick={() => onToggle(s.id)}
          >
            <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate max-w-[30ch]">{s.filename}</p>
              <div className="mt-0.5">{statusBadge(s)}</div>
            </div>
            {s.total_pages > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                {s.total_pages} pages
              </span>
            )}
            <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        );
      })}
    </div>
  );
}
