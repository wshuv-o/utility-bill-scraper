/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, FileSearch, AlertTriangle } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import UploadZone from '@/components/UploadZone';
import PDFCardList from '@/components/PDFCardList';
import ProcessingModal from '@/components/ProcessingModal';
import PDFViewer from '@/components/PDFViewer';
import ExcelPanel from '@/components/ExcelPanel';
import type { PDFSession, Highlight, ExtractedRow } from '@/types/utilscraper';
import { processFile, extractRegions, autoExtract } from '@/lib/api';

export default function Index() {
  const [provider, setProvider]                   = useState('National Grid Gas');
  const [sessions, setSessions]                   = useState<PDFSession[]>([]);
  const [expandedId, setExpandedId]               = useState<string | null>(null);
  const [pendingFiles, setPendingFiles]           = useState<File[]>([]);
  const [processing, setProcessing]               = useState(false);
  const [modalOpen, setModalOpen]                 = useState(false);
  const [modalStep, setModalStep]                 = useState(0);
  const [modalDetail, setModalDetail]             = useState('');
  const [extracting, setExtracting]               = useState(false);
  const [showExcel, setShowExcel]                 = useState(false);
  const [backendDown, setBackendDown]             = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed]   = useState(false);

  const expandedSession = sessions.find(s => s.id === expandedId);

  // ---------------------------------------------------------------------------
  // Clear extracted data + highlights for a session before re-extracting
  // ---------------------------------------------------------------------------
  const clearSessionCache = useCallback((sessionId: string) => {
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? { ...s, extractedData: [], highlights: {}, status: 'ready' as const }
          : s,
      ),
    );
    setShowExcel(false);
  }, []);

  const handleFilesSelected = useCallback((files: File[]) => {
    setPendingFiles(prev => [...prev, ...files]);
  }, []);

  const handleProcess = useCallback(async () => {
    if (!pendingFiles.length) return;
    setProcessing(true);

    for (const file of pendingFiles) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tempSession: PDFSession = {
        id: tempId, filename: file.name, file,
        total_pages: 0, pages: [], status: 'processing',
        highlights: {}, extractedData: [],
      };
      setSessions(prev => [...prev, tempSession]);
      setModalOpen(true);
      setModalStep(0);
      setModalDetail('');

      try {
        const result = await processFile(file, provider, (step, detail) => {
          setModalStep(step);
          setModalDetail(detail || '');
        });
        const ocrCount = result.pages.filter(p => p.is_ocr).length;
        setSessions(prev =>
          prev.map(s =>
            s.id === tempId
              ? { ...s, id: result.session_id, total_pages: result.total_pages, pages: result.pages, status: 'ready' as const }
              : s,
          ),
        );
        setExpandedId(result.session_id);
        setModalOpen(false);
        toast.success(`PDF ready — ${ocrCount > 0 ? `${ocrCount} pages OCR'd` : 'all native text'}`);
        if (ocrCount > 0) {
          toast('Draw boxes over the values you want, then click Extract', { duration: 5000, icon: 'ℹ️' });
        }
      } catch (err: any) {
        setModalOpen(false);
        setSessions(prev => prev.filter(s => s.id !== tempId));
        toast.error(`Processing failed: ${err.message || 'Unknown error'}`);
        if (err.message?.includes('fetch') || err.message?.includes('network')) {
          setBackendDown(true);
        }
      }
    }
    setPendingFiles([]);
    setProcessing(false);
  }, [pendingFiles, provider]);

  const handleHighlightsChange = useCallback(
    (sessionId: string, highlights: Record<number, Highlight[]>) => {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, highlights } : s));
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Manual extract
  // ---------------------------------------------------------------------------
  const handleExtract = useCallback(async () => {
    if (!expandedSession?.file) {
      toast.error('PDF file not found. Please re-upload.');
      return;
    }

    const allHighlights = Object.values(expandedSession.highlights).flat();
    if (!allHighlights.length) {
      toast('Draw highlight boxes first, then click Extract', { icon: 'ℹ️' });
      return;
    }

    // Clear stale results before extracting
    clearSessionCache(expandedSession.id);

    setExtracting(true);
    try {
      const needsExtraction = allHighlights.filter(
        h => !h.isAutoExtracted && (h.extractedValue === undefined || h.extractedValue === null),
      );

      let results: ExtractedRow[] = [];
      if (needsExtraction.length > 0) {
        results = await extractRegions(expandedSession.id, needsExtraction, expandedSession.file);
      }

      const newHighlights = { ...expandedSession.highlights };
      for (const [pageNum, pageHls] of Object.entries(newHighlights)) {
        newHighlights[Number(pageNum)] = pageHls.map(h => {
          if (h.isAutoExtracted && h.extractedValue != null) return h;
          const result = results.find(r => r.page === h.page && r.field === h.field);
          return result ? { ...h, extractedValue: result.value, confidence: result.confidence, wasOcr: result.wasOcr } : h;
        });
      }

      const allResults: ExtractedRow[] = Object.values(newHighlights).flat()
        .filter(h => h.extractedValue !== undefined)
        .map(h => ({
          page: h.page, field: h.field,
          value: h.extractedValue ?? null,
          confidence: h.confidence ?? 'low',
          wasOcr: h.wasOcr ?? false,
        }));

      setSessions(prev =>
        prev.map(s =>
          s.id === expandedSession.id
            ? { ...s, highlights: newHighlights, extractedData: allResults, status: 'extracted' as const }
            : s,
        ),
      );
      setShowExcel(true);

      const nullCount = allResults.filter(r => !r.value).length;
      toast.success(`Extracted ${allResults.length} value${allResults.length !== 1 ? 's' : ''}`);
      if (nullCount > 0) toast.warning(`${nullCount} field${nullCount !== 1 ? 's' : ''} returned empty — try redrawing the box`);
    } catch (err: any) {
      toast.error(`Extraction failed: ${err.message}`);
    }
    setExtracting(false);
  }, [expandedSession, clearSessionCache]);

  // ---------------------------------------------------------------------------
  // Auto-extract
  // ---------------------------------------------------------------------------
  const handleAutoExtract = useCallback(async () => {
    if (!expandedSession?.file) {
      toast.error('PDF file not found. Please re-upload.');
      return;
    }

    // Clear stale results before auto-extracting
    clearSessionCache(expandedSession.id);

    setExtracting(true);
    try {
      const { rows, highlights } = await autoExtract(
        expandedSession.file, provider, expandedSession.id,
      );

      setSessions(prev =>
        prev.map(s =>
          s.id === expandedSession.id
            ? { ...s, extractedData: rows, highlights, status: 'extracted' as const }
            : s,
        ),
      );
      setShowExcel(true);

      if (rows.length === 0) {
        toast.warning('No fields detected. Try drawing highlight boxes manually.');
      } else {
        const nullCount = rows.filter(r => !r.value).length;
        toast.success(`Auto-extracted ${rows.length} value${rows.length !== 1 ? 's' : ''} across all pages`);
        if (nullCount > 0) toast.warning(`${nullCount} field${nullCount !== 1 ? 's' : ''} returned empty`);
      }
    } catch (err: any) {
      toast.error(`Auto-extraction failed: ${err.message}`);
    }
    setExtracting(false);
  }, [expandedSession, provider, clearSessionCache]);

  const hasUploaded  = sessions.length > 0 || pendingFiles.length > 0;
  const showSidebar  = !expandedId || !sidebarCollapsed;

  return (
    <div className="h-screen flex flex-col bg-background">
      {backendDown && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Python backend is offline. Start the server on port 8000 for OCR support.
          <button className="ml-auto underline text-xs" onClick={() => setBackendDown(false)}>Dismiss</button>
        </div>
      )}

      <AppHeader provider={provider} onProviderChange={setProvider} />

      <div className="flex-1 flex overflow-hidden">

        {/* ---------------------------------------------------------------- */}
        {/* Left sidebar — collapsible when a PDF is open                    */}
        {/* ---------------------------------------------------------------- */}
        {showSidebar && (
          <div className={`
            ${expandedId ? 'w-72' : 'flex-1 max-w-2xl mx-auto'}
            shrink-0 p-4 overflow-auto custom-scrollbar flex flex-col gap-3
            border-r border-border relative transition-all duration-200
          `}>
            <UploadZone
              compact={hasUploaded}
              onFilesSelected={handleFilesSelected}
              hasFiles={pendingFiles.length > 0}
              pendingFiles={pendingFiles}
              onProcess={handleProcess}
              processing={processing}
            />
            <PDFCardList
              sessions={sessions}
              expandedId={expandedId}
              onToggle={id => setExpandedId(expandedId === id ? null : id)}
            />

            {!hasUploaded && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileSearch className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold text-foreground">Upload a utility bill PDF to get started</p>
                <p className="text-sm text-muted-foreground mt-1">Drag & drop or click the upload zone above</p>
              </div>
            )}

            {/* Collapse button — tab on the right edge of sidebar */}
            {expandedId && (
              <button
                className="absolute top-1/2 -right-3 -translate-y-1/2
                           w-6 h-12 bg-background border border-border rounded-r-full
                           flex items-center justify-center shadow-sm z-20
                           hover:bg-muted transition-colors"
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}

        {/* Expand tab — shown when sidebar is collapsed */}
        {expandedId && sidebarCollapsed && (
          <button
            className="w-5 shrink-0 bg-muted/40 border-r border-border
                       flex items-center justify-center hover:bg-muted
                       transition-colors z-20"
            onClick={() => setSidebarCollapsed(false)}
            title="Expand sidebar"
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Right panel — PDF viewer + Excel panel                           */}
        {/* ---------------------------------------------------------------- */}
        {expandedId && expandedSession &&
          expandedSession.status !== 'uploading' &&
          expandedSession.status !== 'processing' && (
          <div className="flex-1 flex overflow-hidden">
            <div className={`${showExcel ? 'w-3/5' : 'w-full'} transition-all`}>
              <PDFViewer
                session={expandedSession}
                onHighlightsChange={handleHighlightsChange}
                onExtract={handleExtract}
                onAutoExtract={handleAutoExtract}
                extracting={extracting}
              />
            </div>

            {showExcel && expandedSession.extractedData.length > 0 && (
              <div className="w-2/5 border-l border-border">
                <ExcelPanel
                  data={expandedSession.extractedData}
                  filename={expandedSession.filename}
                  provider={provider}
                  onClose={() => setShowExcel(false)}
                  onReExtract={handleExtract}
                  onDataChange={(d: ExtractedRow[]) =>
                    setSessions(prev =>
                      prev.map(s => s.id === expandedSession.id ? { ...s, extractedData: d } : s)
                    )
                  }
                />
              </div>
            )}
          </div>
        )}

        {!expandedId && hasUploaded && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            ← Select a PDF to view
          </div>
        )}
      </div>

      <ProcessingModal open={modalOpen} step={modalStep} detail={modalDetail} />
    </div>
  );
}