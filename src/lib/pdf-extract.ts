/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { pdfjs } from 'react-pdf';
import type { ExtractedRow, FieldLabel, Highlight } from '@/types/utilscraper';

// ---------------------------------------------------------------------------
// Extract all text from a PDF file, page by page
// ---------------------------------------------------------------------------
export async function extractTextFromPdf(file: File): Promise<Map<number, string>> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = new Map<number, string>();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pageTexts.set(i, text);
  }

  return pageTexts;
}

// ---------------------------------------------------------------------------
// Provider field extraction patterns (client-side fallback)
// ---------------------------------------------------------------------------
interface ProviderPatterns {
  property_name: RegExp[];
  account_number: RegExp[];
  address: RegExp[];
  billing_date: RegExp[];
  total_gas_bill: RegExp[];
}

const PROVIDER_PATTERNS: Record<string, ProviderPatterns> = {
  'National Grid Gas': {
    property_name: [
      /(?:property\s*(?:name)?|customer\s*name|name\s*on\s*account|bill\s*to|service\s*for)[:\s]*([A-Z][A-Za-z\s&.,'-]{2,50})/i,
      /(?:account\s*holder)[:\s]*([A-Z][A-Za-z\s&.,'-]{2,50})/i,
      /^([A-Z][A-Z\s&.,'-]{5,40})\s*(?:LLC|INC|CORP|LTD|CO\b)/im,
    ],
    account_number: [
      /(?:account\s*(?:no|number|#|num))[.:\s]*([0-9][0-9\s-]{5,25})/i,
      /(?:acct\s*(?:no|number|#)?)[.:\s]*([0-9][0-9\s-]{5,25})/i,
      /\b(\d{4}[\s-]\d{4}[\s-]\d{4}(?:[\s-]\d{2,4})?)\b/,
      /\b(\d{10,16})\b/,
    ],
    address: [
      /(?:service\s*address|premises|location)[:\s]*(.{10,80})/i,
      /(\d{1,5}\s+[A-Z][a-zA-Z\s]+(?:St|Ave|Blvd|Rd|Dr|Ln|Way|Pl|Ct|Cir|Pkwy|Terr)[.,]?\s*(?:(?:Apt|Ste|Unit|Fl|Floor|#)\s*\S+)?[,\s]+[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/i,
      /(\d{1,5}\s+\w[\w\s]{3,30}(?:St|Ave|Blvd|Rd|Dr|Ln|Way|Pl|Ct))/i,
    ],
    billing_date: [
      /(?:bill(?:ing)?\s*date|statement\s*date|invoice\s*date|date\s*of\s*bill)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(?:bill(?:ing)?\s*date|statement\s*date)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /(?:period\s*(?:from|ending|through))[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(?:due\s*date)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ],
    total_gas_bill: [
      /(?:total\s*(?:amount\s*)?(?:due|owed|charges?)|amount\s*due|balance\s*due|total\s*(?:gas\s*)?bill|new\s*balance|total\s*current\s*charges)[:\s]*\$?\s*([0-9,]+\.?\d{0,2})/i,
      /\$\s*([0-9,]+\.\d{2})\s*(?:total|due|amount)/i,
      /(?:please\s*pay)[:\s]*\$?\s*([0-9,]+\.\d{2})/i,
    ],
  },
};

for (const p of ['Con Edison', 'PSEG', 'National Fuel', 'KeySpan']) {
  PROVIDER_PATTERNS[p] = { ...PROVIDER_PATTERNS['National Grid Gas'] };
}

PROVIDER_PATTERNS['Con Edison'] = {
  ...PROVIDER_PATTERNS['National Grid Gas'],
  total_gas_bill: [
    /(?:total\s*amount\s*due|amount\s*due|total\s*charges)[:\s]*\$?\s*([0-9,]+\.?\d{0,2})/i,
    /(?:electric\s*&?\s*gas\s*charges)[:\s]*\$?\s*([0-9,]+\.?\d{0,2})/i,
    ...PROVIDER_PATTERNS['National Grid Gas'].total_gas_bill,
  ],
};

// ---------------------------------------------------------------------------
// Page type detection
// Text items < 10 means the page is scanned — pdfjs cannot read it
// ---------------------------------------------------------------------------
function isScannedPage(items: any[]): boolean {
  const textItems = items.filter((i: any) => i.str && i.str.trim().length > 0);
  return textItems.length < 10;
}

// ---------------------------------------------------------------------------
// Auto-extract with highlight positions
// ---------------------------------------------------------------------------
export async function autoExtractWithHighlights(
  file: File,
  provider: string,
): Promise<{ rows: ExtractedRow[]; highlights: Record<number, Highlight[]> }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const patterns = PROVIDER_PATTERNS[provider] || PROVIDER_PATTERNS['National Grid Gas'];
  const rows: ExtractedRow[] = [];
  const highlights: Record<number, Highlight[]> = {};

  let lastPropertyName: string | null = null;
  let lastAccountNumber: string | null = null;
  let lastAddress: string | null = null;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    // Skip scanned pages — backend OCR needed for those
    if (isScannedPage(content.items as any[])) continue;

    const fullText = content.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!fullText || fullText.length < 10) continue;

    const pageResults: Record<string, {
      value: string | null;
      confidence: 'high' | 'medium' | 'low';
      matchedText?: string;
    }> = {};

    for (const [field, fieldPatterns] of Object.entries(patterns) as [FieldLabel, RegExp[]][]) {
      let found: string | null = null;
      let confidence: 'high' | 'medium' | 'low' = 'low';

      for (let pi = 0; pi < fieldPatterns.length; pi++) {
        const match = fullText.match(fieldPatterns[pi]);
        if (match && match[1]) {
          found = match[1].trim();
          confidence = pi <= 1 ? 'high' : 'medium';
          break;
        }
      }
      pageResults[field] = { value: found, confidence, matchedText: found || undefined };
    }

    // Carry-forward
    if (pageResults.property_name.value) lastPropertyName = pageResults.property_name.value;
    else if (lastPropertyName) pageResults.property_name = { value: lastPropertyName, confidence: 'medium' };

    if (pageResults.account_number.value) lastAccountNumber = pageResults.account_number.value;
    else if (lastAccountNumber) pageResults.account_number = { value: lastAccountNumber, confidence: 'medium' };

    if (pageResults.address.value) lastAddress = pageResults.address.value;
    else if (lastAddress) pageResults.address = { value: lastAddress, confidence: 'medium' };

    const pageHls: Highlight[] = [];
    for (const [field, result] of Object.entries(pageResults)) {
      if (!result.value) continue;

      rows.push({
        page: pageNum,
        field,
        value: result.value,
        confidence: result.confidence,
        wasOcr: false,
      });

      if (result.matchedText) {
        const hlRect = findTextPosition(
          content.items as any[],
          result.matchedText,
          pageWidth,
          pageHeight,
        );
        if (hlRect) {
          pageHls.push({
            id: `auto-${pageNum}-${field}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            page: pageNum,
            field: field as FieldLabel,
            x: hlRect.x,
            y: hlRect.y,
            width: hlRect.width,
            height: hlRect.height,
            extractedValue: result.value,
            confidence: result.confidence,
            wasOcr: false,
          });
        }
      }
    }

    if (pageHls.length > 0) highlights[pageNum] = pageHls;
  }

  return { rows, highlights };
}

// ---------------------------------------------------------------------------
// findTextPosition — fixed to return the TIGHTEST matching bounding box.
//
// Bug was: multiple occurrences of the same word (e.g. "226.77" appears 6x)
// caused a giant bounding box spanning the whole page.
// Fix: score each item by how many search words it contains, take only the
// best-scoring cluster of items.
// ---------------------------------------------------------------------------
function findTextPosition(
  items: any[],
  searchText: string,
  pageWidth: number,
  pageHeight: number,
): { x: number; y: number; width: number; height: number } | null {
  const searchLower = searchText.toLowerCase().trim();
  const searchWords = searchLower.split(/\s+/).filter(w => w.length > 1);
  if (searchWords.length === 0) return null;

  // Score every text item
  const scored: { item: any; score: number }[] = [];
  for (const item of items) {
    if (!item.str || !item.transform) continue;
    const itemLower = item.str.toLowerCase();
    let score = 0;
    for (const word of searchWords) {
      if (itemLower.includes(word)) score++;
    }
    if (score > 0) scored.push({ item, score });
  }

  if (scored.length === 0) return null;

  // Take only items with the highest score (best matches)
  const maxScore = Math.max(...scored.map(s => s.score));
  const best = scored.filter(s => s.score === maxScore).map(s => s.item);

  // If multiple items match (e.g. "226.77" appears 6x), take the first one
  // (bills are read top-to-bottom, first match is usually the right one)
  const selected = best.length > 2 ? [best[0]] : best;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const item of selected) {
    const x = item.transform[4];
    // transform[5] is distance from PAGE BOTTOM to text top edge
    // So top-down Y (from page top) = pageHeight - transform[5]
    const itemTop = pageHeight - item.transform[5];
    const itemH = item.height || Math.abs(item.transform[3]) || 12;
    const itemBottom = itemTop + itemH;
    const itemRight = x + (item.width || item.str.length * 6);

    minX = Math.min(minX, x);
    minY = Math.min(minY, itemTop);
    maxX = Math.max(maxX, itemRight);
    maxY = Math.max(maxY, itemBottom);
  }

  // Add small padding
  const pad = 3;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(pageWidth, maxX + pad);
  maxY = Math.min(pageHeight, maxY + pad);

  return {
    x: minX / pageWidth,
    y: minY / pageHeight,
    width: (maxX - minX) / pageWidth,
    height: (maxY - minY) / pageHeight,
  };
}

// ---------------------------------------------------------------------------
// extractFromRegions — MANUAL HIGHLIGHT MODE
//
// Fixed bug: Y coordinate was off by one itemHeight.
//
// Root cause:
//   pdfjs transform[5] = distance from PAGE BOTTOM to the TOP of the text.
//   So itemTop (top-down) = pageHeight - transform[5]   ← TOP of text
//      itemBottom         = itemTop + itemHeight         ← BOTTOM of text
//
// The old code had:
//   itemBaseline = pageHeight - transform[5]   (= itemTop, correct)
//   itemTop      = itemBaseline - itemHeight   (WRONG — this went ABOVE the text)
//   itemBottom   = itemBaseline               (WRONG — this was actually itemTop)
//
// Result: every text item was tested against a window shifted UP by itemHeight,
// so highlights drawn exactly over text never matched.
// ---------------------------------------------------------------------------
export async function extractFromRegions(
  file: File,
  highlights: { page: number; field: string; x: number; y: number; width: number; height: number }[],
): Promise<ExtractedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const results: ExtractedRow[] = [];

  // Group highlights by page so we open each page only once
  const byPage = new Map<number, typeof highlights>();
  for (const h of highlights) {
    if (!byPage.has(h.page)) byPage.set(h.page, []);
    byPage.get(h.page)!.push(h);
  }

  for (const [pageNum, pageHighlights] of byPage.entries()) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    const items = content.items as any[];
    const scanned = isScannedPage(items);

    for (const hl of pageHighlights) {
      // If the page is scanned, pdfjs has no text — signal that OCR is needed
      if (scanned) {
        results.push({
          page: hl.page,
          field: hl.field,
          value: null,
          confidence: 'low',
          wasOcr: true,    // ← tells the caller "retry this with the backend OCR"
        });
        continue;
      }

      // Convert normalised highlight coords → PDF point coords
      const hlLeft   = hl.x * pageWidth;
      const hlRight  = (hl.x + hl.width) * pageWidth;
      const hlTop    = hl.y * pageHeight;
      const hlBottom = (hl.y + hl.height) * pageHeight;

      const matchedTexts: string[] = [];

      for (const item of items) {
        if (!item.str || !item.transform) continue;
        const str = item.str;
        if (!str.trim()) continue;

        const itemX      = item.transform[4];
        const itemH      = item.height || Math.abs(item.transform[3]) || 12;
        const itemW      = item.width  || str.length * 6;

        // ---- FIXED Y coordinate calculation ----
        // transform[5] = distance from page bottom to the TOP of the text
        // itemTop    = pageHeight - transform[5]  (top-down from page top)
        // itemBottom = itemTop + itemH
        const itemTop    = pageHeight - item.transform[5];
        const itemBottom = itemTop + itemH;
        const itemRight  = itemX + itemW;

        // Overlap check — any intersection qualifies
        const overlapX = hlRight  > itemX    && hlLeft  < itemRight;
        const overlapY = hlBottom > itemTop  && hlTop   < itemBottom;

        if (overlapX && overlapY) {
          matchedTexts.push(str);
        }
      }

      const value = matchedTexts.join(' ').replace(/\s+/g, ' ').trim() || null;

      results.push({
        page:       hl.page,
        field:      hl.field,
        value,
        confidence: value && value.length > 2 ? 'high' : value ? 'medium' : 'low',
        wasOcr:     false,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// findTextPositionInPdf — find the exact bounding box of a text value
// on a specific page, exported for use in api.ts after backend auto-extract.
// Returns null for scanned pages (pdfjs has no text layer).
// ---------------------------------------------------------------------------
export async function findTextPositionInPdf(
  file: File,
  pageNumber: number,
  searchText: string,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  if (!searchText || !searchText.trim()) return null;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    if (pageNumber < 1 || pageNumber > pdf.numPages) return null;

    const page    = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const vp      = page.getViewport({ scale: 1 });

    if (isScannedPage(content.items as any[])) return null;

    return findTextPosition(
      content.items as any[],
      searchText,
      vp.width,
      vp.height,
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Legacy auto-extract without highlights (kept for backward compat)
// ---------------------------------------------------------------------------
export function autoExtractFields(
  pageTexts: Map<number, string>,
  provider: string,
): ExtractedRow[] {
  const patterns = PROVIDER_PATTERNS[provider] || PROVIDER_PATTERNS['National Grid Gas'];
  const results: ExtractedRow[] = [];
  let lastPropertyName: string | null = null;
  let lastAccountNumber: string | null = null;
  let lastAddress: string | null = null;

  const sortedPages = Array.from(pageTexts.entries()).sort((a, b) => a[0] - b[0]);

  for (const [pageNum, text] of sortedPages) {
    if (!text || text.length < 10) continue;

    const pageResults: Record<string, { value: string | null; confidence: 'high' | 'medium' | 'low' }> = {};

    for (const [field, fieldPatterns] of Object.entries(patterns) as [FieldLabel, RegExp[]][]) {
      let found: string | null = null;
      let confidence: 'high' | 'medium' | 'low' = 'low';

      for (let pi = 0; pi < fieldPatterns.length; pi++) {
        const match = text.match(fieldPatterns[pi]);
        if (match && match[1]) {
          found = match[1].trim();
          confidence = pi <= 1 ? 'high' : 'medium';
          break;
        }
      }
      pageResults[field] = { value: found, confidence };
    }

    if (pageResults.property_name.value) lastPropertyName = pageResults.property_name.value;
    else if (lastPropertyName) pageResults.property_name = { value: lastPropertyName, confidence: 'medium' };

    if (pageResults.account_number.value) lastAccountNumber = pageResults.account_number.value;
    else if (lastAccountNumber) pageResults.account_number = { value: lastAccountNumber, confidence: 'medium' };

    if (pageResults.address.value) lastAddress = pageResults.address.value;
    else if (lastAddress) pageResults.address = { value: lastAddress, confidence: 'medium' };

    for (const [field, result] of Object.entries(pageResults)) {
      if (result.value) {
        results.push({
          page: pageNum,
          field,
          value: result.value,
          confidence: result.confidence,
          wasOcr: false,
        });
      }
    }
  }

  return results;
}