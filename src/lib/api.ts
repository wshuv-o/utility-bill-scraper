import type { PageInfo, Highlight, ExtractedRow } from '@/types/utilscraper';
import { extractFromRegions, autoExtractWithHighlights, findTextPositionInPdf } from './pdf-extract';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

let backendOnline = false;

async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/utility/health`, {
      signal: AbortSignal.timeout(2000),
    });
    backendOnline = res.ok;
  } catch {
    // Also try /providers as alias
    try {
      const res = await fetch(`${BACKEND_URL}/api/utility/providers`, {
        signal: AbortSignal.timeout(2000),
      });
      backendOnline = res.ok;
    } catch {
      backendOnline = false;
    }
  }
  return backendOnline;
}

// Check on load
checkBackend();

export function isBackendOnline() {
  return backendOnline;
}

// ---------------------------------------------------------------------------
// processFile — upload PDF, detect pages, run OCR on scanned pages
// ---------------------------------------------------------------------------
export async function processFile(
  file: File,
  provider: string,
  onProgress: (step: number, detail?: string) => void,
): Promise<{ session_id: string; total_pages: number; pages: PageInfo[] }> {

  // Try backend first
  try {
    const checked = await checkBackend();
    if (checked) {
      onProgress(0, 'Uploading PDF...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('provider', provider);

      const res = await fetch(`${BACKEND_URL}/api/utility/process`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        onProgress(3, `Ready — ${data.ocr_pages_count ?? 0} pages OCR'd`);
        return {
          session_id: data.session_id,
          total_pages: data.total_pages,
          pages: data.pages,
        };
      }
    }
  } catch {
    /* fall through to client-side */
  }

  // Client-side fallback using pdfjs
  onProgress(0, 'Uploading PDF...');
  try {
    const { pdfjs } = await import('react-pdf');
    const arrayBuffer = await file.arrayBuffer();

    onProgress(1, 'Analysing pages...');
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    const pages: PageInfo[] = [];

    for (let i = 1; i <= totalPages; i++) {
      onProgress(1, `Analysing page ${i} of ${totalPages}`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str).join('');
      const charCount = text.length;
      const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
      const isOcr = charCount < 50 || letterCount < 20;

      pages.push({
        page_number: i,
        is_ocr: isOcr,
        char_count: charCount,
        status: isOcr ? 'ocr' : 'native',
      });
    }

    const ocrCount = pages.filter(p => p.is_ocr).length;
    if (ocrCount > 0) {
      onProgress(2, `${ocrCount} pages may need OCR — backend recommended`);
      await delay(400);
    }

    onProgress(3, 'Ready (client-side mode)');
    return {
      session_id: `local-${Date.now()}`,
      total_pages: totalPages,
      pages,
    };
  } catch (err) {
    console.error('Client-side PDF processing failed:', err);
    throw new Error('Failed to process PDF. Please try a different file.');
  }
}

// ---------------------------------------------------------------------------
// extractRegions — MANUAL HIGHLIGHT MODE
// Extracts ONLY the regions the user drew highlight boxes over.
// Sends all highlights from ALL pages to backend in one call.
// ---------------------------------------------------------------------------
export async function extractRegions(
  sessionId: string,
  highlights: Highlight[],
  file?: File,
): Promise<ExtractedRow[]> {

  // Must have at least one highlight
  if (!highlights || highlights.length === 0) {
    return [];
  }

  // Try backend — sends highlights from ALL pages at once
  try {
    if (backendOnline && !sessionId.startsWith('local-')) {
      const body = JSON.stringify({
        session_id: sessionId,
        highlights: highlights.map(h => ({
          page: h.page, field: h.field,
          x: h.x, y: h.y, width: h.width, height: h.height,
        })),
      });

      let res = await fetch(`${BACKEND_URL}/api/utility/extract-regions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      // 404 = session expired — re-process the file and retry once
      if (res.status === 404 && file) {
        console.warn('Session expired — re-uploading file and retrying...');
        const formData = new FormData();
        formData.append('file', file);
        const reprocess = await fetch(`${BACKEND_URL}/api/utility/process`, {
          method: 'POST',
          body: formData,
        });
        if (reprocess.ok) {
          const redata = await reprocess.json();
          const retryBody = JSON.stringify({
            session_id: redata.session_id,
            highlights: highlights.map(h => ({
              page: h.page, field: h.field,
              x: h.x, y: h.y, width: h.width, height: h.height,
            })),
          });
          res = await fetch(`${BACKEND_URL}/api/utility/extract-regions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: retryBody,
          });
        }
      }

      if (res.ok) {
        const data = await res.json();
        return data.results;
      }
    }
  } catch {
    /* fall through to client-side */
  }

  // Client-side fallback — uses pdfjs text layer
  if (file) {
    try {
      const clientResults = await extractFromRegions(
        file,
        highlights.map(h => ({
          page:   h.page,
          field:  h.field,
          x:      h.x,
          y:      h.y,
          width:  h.width,
          height: h.height,
        })),
      );

      // If any results came back with wasOcr:true it means that page is scanned
      // and pdfjs couldn't read it — try the backend for those specific highlights
      const ocrNeeded = clientResults.filter(r => r.wasOcr && r.value === null);
      const goodResults = clientResults.filter(r => !r.wasOcr || r.value !== null);

      if (ocrNeeded.length > 0 && backendOnline && !sessionId.startsWith('local-')) {
        try {
          const ocrHighlights = highlights.filter(h =>
            ocrNeeded.some(r => r.page === h.page && r.field === h.field)
          );
          const res = await fetch(`${BACKEND_URL}/api/utility/extract-regions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              highlights: ocrHighlights.map(h => ({
                page: h.page, field: h.field,
                x: h.x, y: h.y, width: h.width, height: h.height,
              })),
            }),
          });
          if (res.ok) {
            const data = await res.json();
            return [...goodResults, ...data.results];
          }
        } catch { /* backend retry failed, return what we have */ }
      }

      return clientResults;
    } catch (err) {
      console.error('Client-side region extraction failed:', err);
    }
  }

  // Last resort fallback
  await delay(300);
  return highlights.map(h => ({
    page:       h.page,
    field:      h.field,
    value:      null,
    confidence: 'low' as const,
    wasOcr:     false,
  }));
}

// ---------------------------------------------------------------------------
// autoExtract — AUTO EXTRACT MODE
// Extracts ALL fields from ALL pages — no highlighting needed.
// Backend runs the full OCR + regex pipeline on every page.
// Falls back to client-side pdfjs regex if backend is offline.
// ---------------------------------------------------------------------------
export async function autoExtract(
  file: File,
  provider: string,
  sessionId?: string,
): Promise<{
  rows: ExtractedRow[];
  highlights: Record<number, Highlight[]>;
}> {

  // Try backend auto-extract (handles ALL pages including scanned ones)
  try {
    if (backendOnline && sessionId && !sessionId.startsWith('local-')) {
      const res = await fetch(`${BACKEND_URL}/api/utility/auto-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (res.ok) {
        const data = await res.json();

        // Convert backend results to the ExtractedRow[] format the frontend expects
        const rows: ExtractedRow[] = [];
        for (const bill of data.results) {
          const fields = [
            'property_name',
            'account_number',
            'address',
            'billing_date_start',
            'total_gas_bill',
          ] as const;

          for (const field of fields) {
            const value = bill[field];
            if (value) {
              rows.push({
                page:       bill.page,
                // billing_date_start → billing_date for frontend compat
                field:      field === 'billing_date_start' ? 'billing_date' : field,
                value,
                confidence: 'high',
                wasOcr:     bill.was_ocr ?? false,
              });
            }
          }
        }

        // Build highlights:
        // - Native pages → use pdfjs to find exact text position
        // - OCR pages    → no rect (pdfjs has no text layer), store value only
        //
        // IMPORTANT: for OCR pages we intentionally do NOT store x/y/w/h coords
        // because the backend's hardcoded approximate coords are wrong and would
        // cause garbage text if ever re-cropped. The extractedValue is stored
        // directly on the highlight so Re-Extract skips re-cropping it.
        const highlights: Record<number, Highlight[]> = {};
        for (const row of rows) {
          const pageNum = row.page;
          if (!highlights[pageNum]) highlights[pageNum] = [];

          // Find visual position for the highlight box
          let rect: { x: number; y: number; width: number; height: number } | null = null;

          if (!row.wasOcr && row.value) {
            // Native page — find exact position via pdfjs text layer
            rect = await findTextPositionInPdf(file, row.page, row.value);
          }

          if (!rect) {
            // OCR page OR pdfjs couldn't find text —
            // use backend approximate coords for DISPLAY ONLY.
            // isAutoExtracted=true prevents Re-Extract from re-cropping these.
            // Backend returns highlights keyed by string page number in JSON,
            // try both string and number keys to be safe.
            const pageHighlights: any[] = 
              data.highlights?.[String(row.page)] ||
              data.highlights?.[row.page] ||
              [];

            const backendHl = pageHighlights.find((h: any) => {
              // Normalise field names for comparison
              const hf = h.field === 'billing_date_start' ? 'billing_date' : h.field;
              const rf = row.field === 'billing_date_start' ? 'billing_date' : row.field;
              return hf === rf;
            });
            if (backendHl) {
              rect = { x: backendHl.x, y: backendHl.y, width: backendHl.width, height: backendHl.height };
            }
          }

          highlights[pageNum].push({
            id:              `auto-${row.page}-${row.field}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            page:            row.page,
            field:           row.field,
            x:               rect?.x      ?? 0,
            y:               rect?.y      ?? 0,
            width:           rect?.width  ?? 0,
            height:          rect?.height ?? 0,
            extractedValue:  row.value,
            confidence:      row.confidence,
            wasOcr:          row.wasOcr,
            isAutoExtracted: true,   // ← marks this as display-only, skip on Re-Extract
          });
        }

        return { rows, highlights };
      }
    }
  } catch (err) {
    console.error('Backend auto-extract failed, falling back to client-side:', err);
  }

  // Client-side fallback — regex-based, works on native pages only
  return autoExtractWithHighlights(file, provider);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}