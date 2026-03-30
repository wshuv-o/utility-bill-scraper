import type { PageInfo, Highlight, ExtractedRow } from '@/types/utilscraper';
import { extractFromRegions, autoExtractWithHighlights } from './pdf-extract';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

let backendOnline = false;

async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/utility/providers`, { signal: AbortSignal.timeout(2000) });
    backendOnline = res.ok;
  } catch {
    backendOnline = false;
  }
  return backendOnline;
}

checkBackend();

export function isBackendOnline() {
  return backendOnline;
}

export async function processFile(
  file: File,
  provider: string,
  onProgress: (step: number, detail?: string) => void
): Promise<{ session_id: string; total_pages: number; pages: PageInfo[] }> {
  // Try real backend first
  try {
    const checked = await checkBackend();
    if (checked) {
      onProgress(0);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('provider', provider);
      
      const res = await fetch(`${BACKEND_URL}/api/utility/process`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        onProgress(3);
        return { session_id: data.session_id, total_pages: data.total_pages, pages: data.pages };
      }
    }
  } catch { /* fall through to client-side */ }

  // Client-side processing using pdfjs
  onProgress(0, 'Uploading PDF');

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
      
      // If very few letters relative to page, it's likely scanned/OCR needed
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
      onProgress(2, `${ocrCount} pages may need OCR verification`);
      await delay(500);
    }

    onProgress(3, 'Ready');

    return {
      session_id: `session-${Date.now()}`,
      total_pages: totalPages,
      pages,
    };
  } catch (err) {
    console.error('Client-side PDF processing failed:', err);
    throw new Error('Failed to process PDF. Please try a different file.');
  }
}

export async function extractRegions(
  sessionId: string,
  highlights: Highlight[],
  file?: File
): Promise<ExtractedRow[]> {
  // Try real backend
  try {
    if (backendOnline) {
      const res = await fetch(`${BACKEND_URL}/api/utility/extract-regions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          highlights: highlights.map(h => ({
            page: h.page,
            field: h.field,
            x: h.x, y: h.y, width: h.width, height: h.height,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.results;
      }
    }
  } catch { /* fall through */ }

  // Client-side extraction using pdfjs text layer
  if (file) {
    try {
      return await extractFromRegions(
        file,
        highlights.map(h => ({
          page: h.page,
          field: h.field,
          x: h.x,
          y: h.y,
          width: h.width,
          height: h.height,
        }))
      );
    } catch (err) {
      console.error('Client-side region extraction failed:', err);
    }
  }

  // Fallback mock
  await delay(500);
  return highlights.map(h => ({
    page: h.page,
    field: h.field,
    value: null,
    confidence: 'low' as const,
    wasOcr: false,
  }));
}

/**
 * Auto-extract all fields from all pages using text analysis.
 */
export async function autoExtract(
  file: File,
  provider: string,
): Promise<ExtractedRow[]> {
  const pageTexts = await extractTextFromPdf(file);
  return autoExtractFields(pageTexts, provider);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
