/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  FileText, Upload, ChevronLeft, ChevronRight,
  AlertTriangle, FileSearch,
} from 'lucide-react';
import UploadZone from '@/components/UploadZone';
import PDFCardList from '@/components/PDFCardList';
import ProcessingModal from '@/components/ProcessingModal';
import PDFViewer from '@/components/PDFViewer';
import ExcelPanel from '@/components/ExcelPanel';
import type { PDFSession, Highlight, ExtractedRow, DocumentType } from '@/types/utilscraper';
import { processFile, extractRegions } from '@/lib/api';

export default function Index() {
  const [sessions, setSessions]                 = useState<PDFSession[]>([]);
  const [expandedId, setExpandedId]             = useState<string | null>(null);
  const [pendingFiles, setPendingFiles]         = useState<File[]>([]);
  const [processing, setProcessing]             = useState(false);
  const [modalOpen, setModalOpen]               = useState(false);
  const [modalStep, setModalStep]               = useState(0);
  const [modalDetail, setModalDetail]           = useState('');
  const [extracting, setExtracting]             = useState(false);
  const [showExcel, setShowExcel]               = useState(false);
  const [backendDown, setBackendDown]           = useState(false);
  const [navCollapsed, setNavCollapsed]         = useState(false);
  const [pendingDocType, setPendingDocType]     = useState<DocumentType>('utility_bill');

  const expandedSession = sessions.find(s => s.id === expandedId);
  const hasUploaded     = sessions.length > 0 || pendingFiles.length > 0;

  const clearSessionCache = useCallback((sessionId: string) => {
    setSessions(prev =>
      prev.map(s => s.id === sessionId
        ? { ...s, extractedData: [], highlights: {}, status: 'ready' as const } : s)
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
      setSessions(prev => [...prev, {
        id: tempId, filename: file.name, file,
        docType: pendingDocType,
        total_pages: 0, pages: [], status: 'processing',
        highlights: {}, extractedData: [],
      }]);
      setModalOpen(true); setModalStep(0); setModalDetail('');
      try {
        const result = await processFile(file, '', (step, detail) => {
          setModalStep(step); setModalDetail(detail || '');
        });
        const ocrCount = result.pages.filter(p => p.is_ocr).length;
        setSessions(prev => prev.map(s => s.id === tempId
          ? { ...s, id: result.session_id, total_pages: result.total_pages, pages: result.pages, status: 'ready' as const } : s
        ));
        setExpandedId(result.session_id);
        setModalOpen(false);
        toast.success(`PDF ready — ${ocrCount > 0 ? `${ocrCount} pages OCR'd` : 'all native text'}`);
        if (ocrCount > 0) toast('Draw boxes over the values you want, then click Extract', { duration: 5000, icon: 'ℹ️' });
      } catch (err: any) {
        setModalOpen(false);
        setSessions(prev => prev.filter(s => s.id !== tempId));
        toast.error(`Processing failed: ${err.message || 'Unknown error'}`);
        if (err.message?.includes('fetch') || err.message?.includes('network')) setBackendDown(true);
      }
    }
    setPendingFiles([]); setProcessing(false);
  }, [pendingFiles, pendingDocType]);

  const handleHighlightsChange = useCallback((sessionId: string, highlights: Record<number, Highlight[]>) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, highlights } : s));
  }, []);

  const handleExtract = useCallback(async () => {
    if (!expandedSession?.file) { toast.error('PDF file not found. Please re-upload.'); return; }
    const allHighlights = Object.values(expandedSession.highlights).flat();
    if (!allHighlights.length) { toast('Draw highlight boxes first', { icon: 'ℹ️' }); return; }
    clearSessionCache(expandedSession.id);
    setExtracting(true);
    try {
      const needsExtraction = allHighlights.filter(
        h => !h.isAutoExtracted && (h.extractedValue === undefined || h.extractedValue === null)
      );
      let results: ExtractedRow[] = [];
      if (needsExtraction.length > 0)
        results = await extractRegions(expandedSession.id, needsExtraction, expandedSession.file);
      const newHighlights = { ...expandedSession.highlights };
      let idx = 0;
      for (const [pageNum, pageHls] of Object.entries(newHighlights)) {
        newHighlights[Number(pageNum)] = pageHls.map(h => {
          if (h.isAutoExtracted && h.extractedValue != null) return h;
          if (h.extractedValue !== undefined && h.extractedValue !== null) return h;
          const r = results[idx++];
          return r ? { ...h, extractedValue: r.value, confidence: r.confidence, wasOcr: r.wasOcr } : h;
        });
      }
      const allResults: ExtractedRow[] = Object.values(newHighlights).flat()
        .filter(h => h.extractedValue !== undefined)
        .map(h => ({ page: h.page, field: h.field, value: h.extractedValue ?? null, confidence: h.confidence ?? 'low', wasOcr: h.wasOcr ?? false }));
      setSessions(prev => prev.map(s => s.id === expandedSession.id
        ? { ...s, highlights: newHighlights, extractedData: allResults, status: 'extracted' as const } : s));
      setShowExcel(true);
      const nullCount = allResults.filter(r => !r.value).length;
      toast.success(`Extracted ${allResults.length} value${allResults.length !== 1 ? 's' : ''}`);
      if (nullCount > 0) toast.warning(`${nullCount} field${nullCount !== 1 ? 's' : ''} returned empty`);
    } catch (err: any) { toast.error(`Extraction failed: ${err.message}`); }
    setExtracting(false);
  }, [expandedSession, clearSessionCache]);

  const handleReExtractHighlight = useCallback(async (highlightId: string) => {
    if (!expandedSession?.file) return;
    const newHighlights = { ...expandedSession.highlights };
    let found: Highlight | null = null;
    for (const [pageNum, pageHls] of Object.entries(newHighlights)) {
      newHighlights[Number(pageNum)] = pageHls.map(h => {
        if (h.id === highlightId) { found = { ...h, extractedValue: undefined, confidence: undefined }; return found; }
        return h;
      });
    }
    if (!found) return;
    setSessions(prev => prev.map(s => s.id === expandedSession.id ? { ...s, highlights: newHighlights } : s));
    setExtracting(true);
    try {
      const results = await extractRegions(expandedSession.id, [found], expandedSession.file);
      const result = results[0];
      if (!result) return;
      setSessions(prev => prev.map(s => {
        if (s.id !== expandedSession.id) return s;
        const hls = { ...s.highlights };
        for (const [pageNum, pageHls] of Object.entries(hls))
          hls[Number(pageNum)] = pageHls.map(h => h.id === highlightId
            ? { ...h, extractedValue: result.value, confidence: result.confidence, wasOcr: result.wasOcr } : h);
        const allResults: ExtractedRow[] = Object.values(hls).flat()
          .filter(h => h.extractedValue !== undefined)
          .map(h => ({ page: h.page, field: h.field, value: h.extractedValue ?? null, confidence: h.confidence ?? 'low', wasOcr: h.wasOcr ?? false }));
        return { ...s, highlights: hls, extractedData: allResults };
      }));
      if (result.value) toast.success(`Re-extracted: ${result.value}`);
      else toast.warning('Re-extraction returned empty');
    } catch (err: any) { toast.error(`Re-extraction failed: ${err.message}`); }
    setExtracting(false);
  }, [expandedSession]);

  return (
    <div className="h-screen flex bg-[#f4f6f8]">

      {/* ── Left sidebar: logo + upload + PDF list ─────────────────────── */}
      <aside className={`${navCollapsed ? 'w-14' : 'w-64'} shrink-0 bg-white border-r border-gray-200
                         flex flex-col transition-all duration-200 z-30 overflow-hidden`}>

        {/* Logo row */}
        <div className={`flex items-center gap-2.5 px-4 h-14 border-b border-gray-100 shrink-0 ${navCollapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5 text-white" />
          </div>
          {!navCollapsed && <span className="font-bold text-gray-800 text-sm tracking-tight">UtilScraper</span>}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {navCollapsed ? (
            /* Collapsed — just icons */
            <div className="flex flex-col items-center gap-2 py-4">
              <button
                className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-green-600"
                title="Upload PDF Bills"
                onClick={() => setNavCollapsed(false)}
              >
                <Upload className="w-4 h-4" />
              </button>
              {sessions.length > 0 && (
                <button
                  className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500"
                  title="Your PDFs"
                  onClick={() => setNavCollapsed(false)}
                >
                  <FileSearch className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-5">

              {/* Upload section */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Upload className="w-3.5 h-3.5 text-green-600" />
                  <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Upload PDF Bills</h2>
                </div>
                <UploadZone
                  compact={hasUploaded}
                  onFilesSelected={handleFilesSelected}
                  hasFiles={pendingFiles.length > 0}
                  pendingFiles={pendingFiles}
                  docType={pendingDocType}
                  onDocTypeChange={setPendingDocType}
                  onProcess={handleProcess}
                  processing={processing}
                />
              </div>

              {/* Instructions — shown before first upload */}
              {!hasUploaded && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-green-700 mb-1.5">How it works</p>
                  <ol className="text-[11px] text-green-700 space-y-1 list-decimal list-inside leading-relaxed">
                    <li>Upload utility bill PDFs</li>
                    <li>Click a PDF to open it</li>
                    <li>Draw boxes over the values</li>
                    <li>Label each box with field type</li>
                    <li>Click <strong>Extract</strong></li>
                    <li>Export to <strong>.xlsx</strong></li>
                  </ol>
                </div>
              )}

              {/* PDF list */}
              {sessions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <FileSearch className="w-3.5 h-3.5 text-gray-400" />
                    <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Your PDFs</h2>
                    <span className="ml-auto text-[10px] text-gray-400">{sessions.length} file{sessions.length !== 1 ? 's' : ''}</span>
                  </div>
                  <PDFCardList
                    sessions={sessions}
                    expandedId={expandedId}
                    onToggle={id => setExpandedId(expandedId === id ? null : id)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-gray-100 shrink-0">
          <button
            className="w-full flex items-center justify-center p-2 rounded-lg
                       text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
            onClick={() => setNavCollapsed(v => !v)}
            title={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {navCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shrink-0">
          <div>
            <h1 className="text-base font-bold text-gray-800">Bill Scraper</h1>
            <p className="text-[11px] text-gray-400">Upload bills · highlight values · export to Excel</p>
          </div>
          {backendDown && (
            <div className="ml-auto flex items-center gap-2 bg-red-50 border border-red-200
                            text-red-600 text-xs px-3 py-1.5 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Backend offline — OCR unavailable
              <button className="underline ml-1" onClick={() => setBackendDown(false)}>Dismiss</button>
            </div>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">

          {/* PDF viewer + Excel panel */}
          {expandedId && expandedSession &&
            expandedSession.status !== 'uploading' &&
            expandedSession.status !== 'processing' ? (
            <div className="flex-1 flex overflow-hidden">
              <div className={`${showExcel ? 'w-3/5' : 'w-full'} transition-all flex flex-col overflow-hidden`}>
                {/* Viewer filename bar */}
                <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 shrink-0">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-gray-700 truncate">{expandedSession.filename}</span>
                  {expandedSession.pages.some(p => p.is_ocr) && (
                    <span className="ml-auto text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                      {expandedSession.pages.filter(p => p.is_ocr).length} pages OCR'd
                    </span>
                  )}
                </div>
                <PDFViewer
                  session={expandedSession}
                  onHighlightsChange={handleHighlightsChange}
                  onExtract={handleExtract}
                  onReExtract={handleReExtractHighlight}
                  extracting={extracting}
                />
              </div>

              {showExcel && expandedSession.extractedData.length > 0 && (
                <div className="w-2/5 border-l border-gray-200">
                  <ExcelPanel
                    data={expandedSession.extractedData}
                    filename={expandedSession.filename}
                    provider="Utility Bill"
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
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                  <FileSearch className="w-8 h-8 text-green-400" />
                </div>
                <p className="text-sm font-semibold text-gray-600">
                  {hasUploaded ? 'Select a PDF from the sidebar to view' : 'Upload a utility bill PDF to get started'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {hasUploaded ? 'Click any file on the left' : 'Use the upload panel on the left'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ProcessingModal open={modalOpen} step={modalStep} detail={modalDetail} />
    </div>
  );
}