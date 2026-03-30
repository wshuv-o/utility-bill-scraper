import type { PageInfo, Highlight, ExtractedRow } from '@/types/utilscraper';

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

// Check once on load
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
  } catch { /* fall through to mock */ }

  // Mock processing
  const totalPages = Math.floor(Math.random() * 10) + 3;
  
  onProgress(0, 'Uploading PDF');
  await delay(800);
  onProgress(1, `Analysing pages (${totalPages} found)`);
  await delay(1200);

  const pages: PageInfo[] = [];
  const ocrPages = Math.floor(totalPages * 0.3);
  for (let i = 1; i <= totalPages; i++) {
    const isOcr = i <= ocrPages;
    pages.push({
      page_number: i,
      is_ocr: isOcr,
      char_count: Math.floor(Math.random() * 3000) + 500,
      status: isOcr ? 'ocr' : 'native',
    });
  }

  if (ocrPages > 0) {
    for (let i = 1; i <= ocrPages; i++) {
      onProgress(2, `Running OCR (page ${i} of ${ocrPages})`);
      await delay(600);
    }
  }

  onProgress(3, 'Finalising...');
  await delay(500);

  return {
    session_id: `session-${Date.now()}`,
    total_pages: totalPages,
    pages,
  };
}

export async function extractRegions(
  sessionId: string,
  highlights: Highlight[]
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

  // Mock extraction
  await delay(1500);

  const mockValues: Record<string, string[]> = {
    property_name: ['JOLI ON GUIDER LLC', 'ACME PROPERTIES', 'GREENFIELD ESTATES'],
    account_number: ['4812-3901-7722', '9928-1102-3345', '5501-8833-2210'],
    address: ['142 W 57th St, New York, NY 10019', '88 Pine St, Fl 4, NY 10005'],
    billing_date: ['01/15/2024', '02/01/2024', '12/15/2023'],
    total_gas_bill: ['$226.77', '$189.43', '$312.50', '$94.22'],
    custom: ['N/A', 'See attached', 'Zone 4'],
  };

  return highlights.map(h => {
    const vals = mockValues[h.field] || mockValues.custom;
    const isEmpty = Math.random() < 0.1;
    return {
      page: h.page,
      field: h.field,
      value: isEmpty ? null : vals[Math.floor(Math.random() * vals.length)],
      confidence: Math.random() > 0.3 ? 'high' : 'medium',
      wasOcr: Math.random() > 0.7,
    } as ExtractedRow;
  });
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
