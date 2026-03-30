import { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFSession, Highlight, FieldLabel, ViewerTool } from '@/types/utilscraper';
import { getFieldConfig } from '@/types/utilscraper';
import ViewerToolbar from './ViewerToolbar';
import HighlightOverlay from './HighlightOverlay';
import FieldLabelPicker from './FieldLabelPicker';
import HighlightLegend from './HighlightLegend';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PDFViewerProps {
  session: PDFSession;
  onHighlightsChange: (sessionId: string, highlights: Record<number, Highlight[]>) => void;
  onExtract: () => void;
  extracting: boolean;
}

export default function PDFViewer({ session, onHighlightsChange, onExtract, extracting }: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<ViewerTool>('cursor');
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; x: number; y: number; w: number; h: number } | null>(null);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number; rect: { x: number; y: number; w: number; h: number } } | null>(null);
  const [showFirstHint, setShowFirstHint] = useState(true);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const totalPages = numPages || session.total_pages;
  const pageHighlights = session.highlights[currentPage] || [];
  const currentPageInfo = session.pages.find(p => p.page_number === currentPage);
  const allHighlights = Object.values(session.highlights).flat();

  // Create a stable object URL from the File
  useEffect(() => {
    if (session.file) {
      const url = URL.createObjectURL(session.file);
      setFileUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [session.file]);

  const updateHighlights = useCallback((pageNum: number, hl: Highlight[]) => {
    const next = { ...session.highlights, [pageNum]: hl };
    onHighlightsChange(session.id, next);
  }, [session, onHighlightsChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool !== 'highlight' || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setDrawing({ startX: x, startY: y, x, y, w: 0, h: 0 });
  }, [tool]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    setDrawing({
      ...drawing,
      x: Math.min(drawing.startX, cx),
      y: Math.min(drawing.startY, cy),
      w: Math.abs(cx - drawing.startX),
      h: Math.abs(cy - drawing.startY),
    });
  }, [drawing]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!drawing || drawing.w < 0.01 || drawing.h < 0.01) {
      setDrawing(null);
      return;
    }
    if (pageRef.current) {
      const rect = pageRef.current.getBoundingClientRect();
      setPickerPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        rect: { x: drawing.x, y: drawing.y, w: drawing.w, h: drawing.h },
      });
    }
    setDrawing(null);
  }, [drawing]);

  const handleLabelSelect = useCallback((field: FieldLabel, customLabel?: string) => {
    if (!pickerPos) return;
    const hl: Highlight = {
      id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      page: currentPage,
      field,
      x: pickerPos.rect.x,
      y: pickerPos.rect.y,
      width: pickerPos.rect.w,
      height: pickerPos.rect.h,
    };
    updateHighlights(currentPage, [...pageHighlights, hl]);
    setPickerPos(null);
    setShowFirstHint(false);
  }, [pickerPos, currentPage, pageHighlights, updateHighlights]);

  const handleDeleteHighlight = useCallback((id: string) => {
    updateHighlights(currentPage, pageHighlights.filter(h => h.id !== id));
  }, [currentPage, pageHighlights, updateHighlights]);

  const handleEraseAll = useCallback(() => {
    updateHighlights(currentPage, []);
  }, [currentPage, updateHighlights]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pickerPos) {
        setPickerPos(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pickerPos]);

  if (!fileUrl) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading PDF...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <ViewerToolbar
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        tool={tool}
        isOcr={currentPageInfo?.is_ocr || false}
        onPageChange={setCurrentPage}
        onZoomChange={setZoom}
        onToolChange={(t) => { setTool(t); if (t === 'eraser') handleEraseAll(); }}
        onExtract={onExtract}
        extracting={extracting}
        hasHighlights={allHighlights.length > 0}
      />

      <div className="flex-1 overflow-auto bg-viewer relative custom-scrollbar">
        {showFirstHint && tool === 'highlight' && allHighlights.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-foreground/70 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium backdrop-blur">
              Draw boxes over the values you want to extract
            </div>
          </div>
        )}

        <div className="flex justify-center p-6">
          <div
            ref={pageRef}
            className="relative shadow-lg"
            style={{ cursor: tool === 'highlight' ? 'crosshair' : 'default' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <Document
              file={fileUrl}
              onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
              loading={<div className="w-[600px] h-[800px] bg-card animate-pulse rounded" />}
              error={<div className="w-[600px] h-[400px] flex items-center justify-center text-destructive text-sm">Failed to load PDF</div>}
            >
              <Page
                pageNumber={currentPage}
                scale={zoom * 1.5}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>

            <HighlightOverlay
              highlights={pageHighlights}
              drawing={drawing}
              onDelete={handleDeleteHighlight}
              tool={tool}
            />

            {pickerPos && (
              <FieldLabelPicker
                x={pickerPos.x}
                y={pickerPos.y}
                onSelect={handleLabelSelect}
                onCancel={() => setPickerPos(null)}
              />
            )}
          </div>
        </div>

        {allHighlights.length > 0 && (
          <HighlightLegend highlights={allHighlights} />
        )}
      </div>
    </div>
  );
}
