/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  FileText, Upload, ChevronLeft, ChevronRight,
  AlertTriangle, FileSearch, X,
} from 'lucide-react';
import UploadZone from '@/components/UploadZone';
import PDFCardList from '@/components/PDFCardList';
import ProcessingModal from '@/components/ProcessingModal';
import PDFViewer from '@/components/PDFViewer';
import ExcelPanel from '@/components/ExcelPanel';
import type { PDFSession, Highlight, ExtractedRow, DocumentType } from '@/types/utilscraper';
import { DOCUMENT_TYPES } from '@/types/utilscraper';
import { processFile, extractRegions } from '@/lib/api';

export default function Index() {
  const [sessions, setSessions]                 = useState<PDFSession[]>([]);
  const [openTabs, setOpenTabs]                 = useState<string[]>([]);
  const [activeTabId, setActiveTabId]           = useState<string | null>(null);
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

  const activeSession = sessions.find(s => s.id === activeTabId);
  const hasUploaded   = sessions.length > 0 || pendingFiles.length > 0;

  // Tab sessions in order, resolved from IDs
  const tabSessions = useMemo(
    () => openTabs.map(id => sessions.find(s => s.id === id)).filter(Boolean) as PDFSession[],
    [openTabs, sessions],
  );

  // Open a tab (add if not already open) and make it active
  const openTab = useCallback((id: string) => {
    setOpenTabs(prev => prev.includes(id) ? prev : [...prev, id]);
    setActiveTabId(id);
  }, []);

  // Close a tab; if it was active, switch to the nearest neighbour
  const closeTab = useCallback((id: string) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t !== id);
      if (activeTabId === id) {
        const idx = prev.indexOf(id);
        const neighbour = next[Math.min(idx, next.length - 1)] ?? null;
        setActiveTabId(neighbour);
      }
      return next;
    });
  }, [activeTabId]);

  // Combined extracted data from ALL sessions for the Excel panel
  const combinedExtractedData = useMemo(
    () => sessions.flatMap(s => s.extractedData),
    [sessions],
  );

  const handleFilesSelected = useCallback((files: File[]) => {
    setPendingFiles(prev => [...prev, ...files]);
  }, []);

  const handleProcess = useCallback(async () => {
    if (!pendingFiles.length) return;
    setProcessing(true);
    const newSessionIds: string[] = [];
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
        // Update temp session with real ID
        setSessions(prev => prev.map(s => s.id === tempId
          ? { ...s, id: result.session_id, total_pages: result.total_pages, pages: result.pages, status: 'ready' as const } : s
        ));
        // Also fix any tab that was opened with the tempId
        setOpenTabs(prev => prev.map(t => t === tempId ? result.session_id : t));
        if (activeTabId === tempId) setActiveTabId(result.session_id);
        newSessionIds.push(result.session_id);
        setModalOpen(false);
        toast.success(`PDF ready — ${ocrCount > 0 ? `${ocrCount} pages OCR'd` : 'all native text'}`);
        if (ocrCount > 0) toast('Draw boxes over the values you want, then click Extract', { duration: 5000, icon: 'ℹ️' });
      } catch (err: any) {
        setModalOpen(false);
        setSessions(prev => prev.filter(s => s.id !== tempId));
        setOpenTabs(prev => prev.filter(t => t !== tempId));
        toast.error(`Processing failed: ${err.message || 'Unknown error'}`);
        if (err.message?.includes('fetch') || err.message?.includes('network')) setBackendDown(true);
      }
    }
    // Open all processed files as tabs, activate the first one
    if (newSessionIds.length > 0) {
      setOpenTabs(prev => {
        const merged = [...prev];
        for (const id of newSessionIds) {
          if (!merged.includes(id)) merged.push(id);
        }
        return merged;
      });
      setActiveTabId(newSessionIds[0]);
    }
    setPendingFiles([]); setProcessing(false);
  }, [pendingFiles, pendingDocType, activeTabId]);

  const handleHighlightsChange = useCallback((sessionId: string, highlights: Record<number, Highlight[]>) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, highlights } : s));
  }, []);

  // Extract ALL sessions that have highlights (not just the active tab)
  const handleExtract = useCallback(async () => {
    const targets = sessions.filter(s =>
      s.file && Object.values(s.highlights).flat().length > 0 &&
      (s.status === 'ready' || s.status === 'extracted')
    );
    if (!targets.length) { toast('Draw highlight boxes first', { icon: 'ℹ️' }); return; }

    setExtracting(true);
    let totalExtracted = 0;
    let totalNull = 0;

    for (const sess of targets) {
      const allHl = Object.values(sess.highlights).flat();
      const needsExtraction = allHl.filter(
        h => !h.isAutoExtracted && (h.extractedValue === undefined || h.extractedValue === null)
      );

      try {
        let results: ExtractedRow[] = [];
        if (needsExtraction.length > 0)
          results = await extractRegions(sess.id, needsExtraction, sess.file!);

        const newHighlights = { ...sess.highlights };
        let idx = 0;
        for (const [pageNum, pageHls] of Object.entries(newHighlights)) {
          newHighlights[Number(pageNum)] = pageHls.map(h => {
            if (h.isAutoExtracted && h.extractedValue != null) return h;
            if (h.extractedValue !== undefined && h.extractedValue !== null) return h;
            const r = results[idx++];
            return r ? { ...h, extractedValue: r.value, confidence: r.confidence, wasOcr: r.wasOcr } : h;
          });
        }
        const sessResults: ExtractedRow[] = Object.values(newHighlights).flat()
          .filter(h => h.extractedValue !== undefined)
          .map(h => ({
            page: h.page, field: h.field, value: h.extractedValue ?? null,
            confidence: h.confidence ?? 'low', wasOcr: h.wasOcr ?? false,
            filename: sess.filename, sessionId: sess.id,
          }));

        setSessions(prev => prev.map(s => s.id === sess.id
          ? { ...s, highlights: newHighlights, extractedData: sessResults, status: 'extracted' as const } : s));

        totalExtracted += sessResults.length;
        totalNull += sessResults.filter(r => !r.value).length;
      } catch (err: any) {
        toast.error(`Extraction failed for ${sess.filename}: ${err.message}`);
      }
    }

    setShowExcel(true);
    toast.success(`Extracted ${totalExtracted} value${totalExtracted !== 1 ? 's' : ''} from ${targets.length} PDF${targets.length !== 1 ? 's' : ''}`);
    if (totalNull > 0) toast.warning(`${totalNull} field${totalNull !== 1 ? 's' : ''} returned empty`);
    setExtracting(false);
  }, [sessions]);

  const handleReExtractHighlight = useCallback(async (highlightId: string) => {
    if (!activeSession?.file) return;
    const newHighlights = { ...activeSession.highlights };
    let found: Highlight | null = null;
    for (const [pageNum, pageHls] of Object.entries(newHighlights)) {
      newHighlights[Number(pageNum)] = pageHls.map(h => {
        if (h.id === highlightId) { found = { ...h, extractedValue: undefined, confidence: undefined }; return found; }
        return h;
      });
    }
    if (!found) return;
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, highlights: newHighlights } : s));
    setExtracting(true);
    try {
      const results = await extractRegions(activeSession.id, [found], activeSession.file);
      const result = results[0];
      if (!result) return;
      setSessions(prev => prev.map(s => {
        if (s.id !== activeSession.id) return s;
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
  }, [activeSession]);

  // Mirror the active session's highlights (page-for-page) to all other PDFs
  const handleApplyToAllPdfs = useCallback((sourceHighlights: Record<number, Highlight[]>) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeTabId) return s; // skip the source session
      if (s.status !== 'ready' && s.status !== 'extracted') return s;
      const next: Record<number, Highlight[]> = {};
      for (const [pageStr, pageHls] of Object.entries(sourceHighlights)) {
        const pageNum = Number(pageStr);
        // Only copy if target PDF has that page
        const totalPgs = s.total_pages || s.pages.length;
        if (pageNum > totalPgs) continue;
        next[pageNum] = pageHls.map(h => ({
          ...h,
          id: `hl-${Date.now()}-${s.id.slice(-4)}-${pageNum}-${Math.random().toString(36).slice(2, 6)}`,
          page: pageNum,
          extractedValue: undefined,
          confidence: undefined,
        }));
      }
      return { ...s, highlights: next, extractedData: [], status: 'ready' as const };
    }));
    toast.success('Highlights mirrored to all open PDFs (matching pages)');
  }, [activeTabId]);

  // Can we show a viewer?
  const hasActiveViewer = activeSession &&
    activeSession.status !== 'uploading' &&
    activeSession.status !== 'processing';

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
                title="Upload PDFs"
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
                  <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Upload PDFs</h2>
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
                    <li>Choose document type</li>
                    <li>Upload PDF files</li>
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
                    expandedId={activeTabId}
                    onToggle={openTab}
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
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── Tab bar ──────────────────────────────────────────────── */}
          {tabSessions.length > 0 && (
            <div className="bg-[#e8eaed] flex items-end overflow-x-auto shrink-0 px-1 pt-1 gap-px">
              {tabSessions.map(s => {
                const isActive = s.id === activeTabId;
                const dt = DOCUMENT_TYPES.find(d => d.value === s.docType);
                return (
                  <div
                    key={s.id}
                    className={`group flex items-center gap-1.5 pl-3 pr-1 py-1.5 rounded-t-lg text-xs cursor-pointer
                      max-w-[200px] min-w-[100px] select-none transition-colors
                      ${isActive
                        ? 'bg-white text-gray-800 font-medium'
                        : 'bg-[#dcdfe3] text-gray-500 hover:bg-[#d3d6da]'
                      }`}
                    onClick={() => setActiveTabId(s.id)}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: dt?.color ?? '#64748b' }}
                    />
                    <span className="truncate flex-1">{s.filename}</span>
                    <button
                      className={`p-0.5 rounded transition-colors shrink-0
                        ${isActive
                          ? 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'
                          : 'opacity-0 group-hover:opacity-100 hover:bg-gray-300 text-gray-400 hover:text-gray-600'
                        }`}
                      onClick={e => { e.stopPropagation(); closeTab(s.id); }}
                      title="Close tab"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Viewer + Excel panel ─────────────────────────────────── */}
          {hasActiveViewer ? (
            <div className="flex-1 flex overflow-hidden">
              <div className={`${showExcel ? 'w-3/5' : 'w-full'} transition-all flex flex-col overflow-hidden`}>
                <PDFViewer
                  key={activeSession.id}
                  session={activeSession}
                  onHighlightsChange={handleHighlightsChange}
                  onExtract={handleExtract}
                  onReExtract={handleReExtractHighlight}
                  onApplyToAllPdfs={handleApplyToAllPdfs}
                  extracting={extracting}
                />
              </div>

              {showExcel && combinedExtractedData.length > 0 && (
                <div className="w-2/5 border-l border-gray-200">
                  <ExcelPanel
                    data={combinedExtractedData}
                    filename={sessions.filter(s => s.extractedData.length > 0).map(s => s.filename).join(', ')}
                    provider={DOCUMENT_TYPES.find(d => d.value === activeSession.docType)?.label ?? 'Document'}
                    onClose={() => setShowExcel(false)}
                    onReExtract={handleExtract}
                    onDataChange={(d: ExtractedRow[]) => {
                      // Distribute edited rows back to their sessions
                      setSessions(prev => prev.map(s => ({
                        ...s,
                        extractedData: d.filter(r => r.sessionId === s.id),
                      })));
                    }}
                    multiFile={sessions.filter(s => s.extractedData.length > 0).length > 1}
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
                  {hasUploaded ? 'Select a PDF from the sidebar to view' : 'Upload a PDF to get started'}
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
