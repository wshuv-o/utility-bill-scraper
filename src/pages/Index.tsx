/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import UploadZone from '@/components/UploadZone';
import PDFCardList from '@/components/PDFCardList';
import ProcessingModal from '@/components/ProcessingModal';
import PDFViewer from '@/components/PDFViewer';
import ExcelPanel from '@/components/ExcelPanel';
import type { PDFSession, Highlight, ExtractedRow } from '@/types/utilscraper';
import { processFile, extractRegions, autoExtract } from '@/lib/api';
import { AlertTriangle, FileSearch } from 'lucide-react';

export default function Index() {
  const [provider, setProvider]           = useState('National Grid Gas');
  const [sessions, setSessions]           = useState<PDFSession[]>([]);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [pendingFiles, setPendingFiles]   = useState<File[]>([]);
  const [processing, setProcessing]       = useState(false);
  const [modalOpen, setModalOpen]         = useState(false);
  const [modalStep, setModalStep]         = useState(0);
  const [modalDetail, setModalDetail]     = useState('');
  const [extracting, setExtracting]       = useState(false);
  const [showExcel, setShowExcel]         = useState(false);
  const [backendDown, setBackendDown]     = useState(false);

  const expandedSession = sessions.find(s => s.id === expandedId);

  const handleFilesSelected = useCallback((files: File[]) => {
    setPendingFiles(prev => [...prev, ...files]);
  }, []);

  const handleProcess = useCallback(async () => {
    if (!pendingFiles.length) return;
    setProcessing(true);

    for (const file of pendingFiles) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tempSession: PDFSession = {
        id: tempId,
        filename: file.name,
        file,
        total_pages: 0,
        pages: [],
        status: 'processing',
        highlights: {},
        extractedData: [],
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
              ? {
                  ...s,
                  id:          result.session_id,
                  total_pages: result.total_pages,
                  pages:       result.pages,
                  status:      'ready' as const,
                }
              : s,
          ),
        );
        setExpandedId(result.session_id);
        setModalOpen(false);
        toast.success(`PDF ready — ${ocrCount > 0 ? `${ocrCount} pages OCR'd` : 'all native text'}`);
        if (ocrCount > 0) {
          // sonner uses toast() not toast.info()
          toast('Draw boxes over the values you want, then click Extract', {
            duration: 5000,
            icon: 'ℹ️',
          });
        }
      } catch (err: any) {
        setModalOpen(false);
        setSessions(prev => prev.filter(s => s.id !== tempId));
        toast.error(`Processing failed: ${err.message || 'Unknown error'}`);
        // Only mark backend as down if it's a network error, not a file error
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

  const handleExtract = useCallback(async () => {
    if (!expandedSession) return;
    // Guard: file must exist
    if (!expandedSession.file) {
      toast.error('PDF file not found. Please re-upload.');
      return;
    }

    const allHighlights = Object.values(expandedSession.highlights).flat();
    if (!allHighlights.length) {
      toast('Draw highlight boxes first, then click Extract', { icon: 'ℹ️' });
      return;
    }

    setExtracting(true);
    try {
      const results = await extractRegions(
        expandedSession.id,
        allHighlights,
        expandedSession.file,
      );

      // Update each highlight with its extracted value
      const newHighlights = { ...expandedSession.highlights };
      for (const [pageNum, pageHls] of Object.entries(newHighlights)) {
        newHighlights[Number(pageNum)] = pageHls.map(h => {
          const result = results.find(r => r.page === h.page && r.field === h.field);
          return result
            ? { ...h, extractedValue: result.value, confidence: result.confidence, wasOcr: result.wasOcr }
            : h;
        });
      }

      setSessions(prev =>
        prev.map(s =>
          s.id === expandedSession.id
            ? { ...s, highlights: newHighlights, extractedData: results, status: 'extracted' as const }
            : s,
        ),
      );
      setShowExcel(true);

      const nullCount = results.filter(r => !r.value).length;
      toast.success(`Extracted ${results.length} value${results.length !== 1 ? 's' : ''}`);
      if (nullCount > 0) {
        toast.warning(`${nullCount} field${nullCount !== 1 ? 's' : ''} returned empty — try redrawing the box`);
      }
    } catch (err: any) {
      toast.error(`Extraction failed: ${err.message}`);
    }
    setExtracting(false);
  }, [expandedSession]);

  const handleAutoExtract = useCallback(async () => {
    if (!expandedSession) return;
    if (!expandedSession.file) {
      toast.error('PDF file not found. Please re-upload.');
      return;
    }

    setExtracting(true);
    try {
      const { rows, highlights } = await autoExtract(
        expandedSession.file,
        provider,
        expandedSession.id,   // ← pass session_id so backend OCR is used for scanned pages
      );

      // Merge auto-extract highlights with any existing manual highlights
      const mergedHighlights = { ...expandedSession.highlights };
      for (const [pageNum, pageHls] of Object.entries(highlights)) {
        const pg = Number(pageNum);
        mergedHighlights[pg] = [...(mergedHighlights[pg] || []), ...pageHls];
      }

      setSessions(prev =>
        prev.map(s =>
          s.id === expandedSession.id
            ? { ...s, extractedData: rows, highlights: mergedHighlights, status: 'extracted' as const }
            : s,
        ),
      );
      setShowExcel(true);

      if (rows.length === 0) {
        toast.warning('No fields detected. Try drawing highlight boxes manually.');
      } else {
        const nullCount = rows.filter(r => !r.value).length;
        toast.success(`Auto-extracted ${rows.length} value${rows.length !== 1 ? 's' : ''} across all pages`);
        if (nullCount > 0) {
          toast.warning(`${nullCount} field${nullCount !== 1 ? 's' : ''} returned empty`);
        }
      }
    } catch (err: any) {
      toast.error(`Auto-extraction failed: ${err.message}`);
    }
    setExtracting(false);
  }, [expandedSession, provider]);

  const hasUploaded = sessions.length > 0 || pendingFiles.length > 0;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Backend offline banner */}
      {backendDown && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Python backend is offline. Start the server on port 8000 for OCR support.
          <button
            className="ml-auto underline text-xs"
            onClick={() => setBackendDown(false)}
          >
            Dismiss
          </button>
        </div>
      )}

      <AppHeader provider={provider} onProviderChange={setProvider} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — upload + card list */}
        <div
          className={`${expandedId ? 'w-72 shrink-0' : 'flex-1 max-w-2xl mx-auto'} p-4 overflow-auto custom-scrollbar flex flex-col gap-3 transition-all`}
        >
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
              <p className="text-lg font-semibold text-foreground">
                Upload a utility bill PDF to get started
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Drag & drop or click the upload zone above
              </p>
            </div>
          )}
        </div>

        {/* Right panel — PDF viewer + Excel panel */}
        {expandedId &&
          expandedSession &&
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
                        prev.map(s =>
                          s.id === expandedSession.id
                            ? { ...s, extractedData: d }
                            : s,
                        ),
                      )
                    }
                  />
                </div>
              )}
            </div>
          )}

        {/* Empty state when files uploaded but none expanded */}
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