import { pdfjs } from 'react-pdf';
import type { ExtractedRow, FieldLabel, Highlight } from '@/types/utilscraper';

/**
 * Extract all text from a PDF file using pdfjs, page by page.
 */
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

/**
 * Provider-specific field extraction patterns.
 */
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

// Clone National Grid patterns as base for other providers
for (const p of ['Con Edison', 'PSEG', 'National Fuel', 'KeySpan']) {
  PROVIDER_PATTERNS[p] = { ...PROVIDER_PATTERNS['National Grid Gas'] };
}

// Add Con Edison specific patterns
PROVIDER_PATTERNS['Con Edison'] = {
  ...PROVIDER_PATTERNS['National Grid Gas'],
  total_gas_bill: [
    /(?:total\s*amount\s*due|amount\s*due|total\s*charges)[:\s]*\$?\s*([0-9,]+\.?\d{0,2})/i,
    /(?:electric\s*&?\s*gas\s*charges)[:\s]*\$?\s*([0-9,]+\.?\d{0,2})/i,
    ...PROVIDER_PATTERNS['National Grid Gas'].total_gas_bill,
  ],
};

/**
 * Auto-extract fields from all pages of a PDF.
 * Returns extracted rows AND highlight positions for visual feedback.
 */
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

    // Build full text for regex matching
    const fullText = content.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!fullText || fullText.length < 10) continue;

    const pageResults: Record<string, { value: string | null; confidence: 'high' | 'medium' | 'low'; matchedText?: string }> = {};

    // Extract each field using patterns
    for (const [field, fieldPatterns] of Object.entries(patterns) as [FieldLabel, RegExp[]][]) {
      let found: string | null = null;
      let confidence: 'high' | 'medium' | 'low' = 'low';

      for (let pi = 0; pi < fieldPatterns.length; pi++) {
        const match = fullText.match(fieldPatterns[pi]);
        if (match && match[1]) {
          found = match[1].trim();
          confidence = pi === 0 ? 'high' : pi === 1 ? 'high' : 'medium';
          break;
        }
      }

      pageResults[field] = { value: found, confidence, matchedText: found || undefined };
    }

    // Carry-forward logic
    if (pageResults.property_name.value) {
      lastPropertyName = pageResults.property_name.value;
    } else if (lastPropertyName) {
      pageResults.property_name = { value: lastPropertyName, confidence: 'medium' };
    }

    if (pageResults.account_number.value) {
      lastAccountNumber = pageResults.account_number.value;
    } else if (lastAccountNumber) {
      pageResults.account_number = { value: lastAccountNumber, confidence: 'medium' };
    }

    if (pageResults.address.value) {
      lastAddress = pageResults.address.value;
    } else if (lastAddress) {
      pageResults.address = { value: lastAddress, confidence: 'medium' };
    }

    // For each extracted field, try to find it spatially in the text items
    const pageHls: Highlight[] = [];
    for (const [field, result] of Object.entries(pageResults)) {
      if (result.value) {
        rows.push({
          page: pageNum,
          field,
          value: result.value,
          confidence: result.confidence,
          wasOcr: false,
        });

        // Try to find spatial position of matched text
        if (result.matchedText) {
          const hlRect = findTextPosition(content.items as any[], result.matchedText, pageWidth, pageHeight);
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
    }

    if (pageHls.length > 0) {
      highlights[pageNum] = pageHls;
    }
  }

  return { rows, highlights };
}

/**
 * Find the normalized bounding box of matched text within PDF text items.
 */
function findTextPosition(
  items: any[],
  searchText: string,
  pageWidth: number,
  pageHeight: number,
): { x: number; y: number; width: number; height: number } | null {
  const searchLower = searchText.toLowerCase().trim();
  const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);
  if (searchWords.length === 0) return null;

  // Try to find items containing the search text words
  const matchedItems: any[] = [];
  
  for (const item of items) {
    if (!item.str || !item.transform) continue;
    const itemLower = item.str.toLowerCase().trim();
    if (!itemLower) continue;
    
    // Check if this item contains any of the search words
    for (const word of searchWords) {
      if (itemLower.includes(word) || word.includes(itemLower)) {
        matchedItems.push(item);
        break;
      }
    }
  }

  if (matchedItems.length === 0) return null;

  // Compute bounding box from matched items
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const item of matchedItems) {
    const x = item.transform[4];
    const y = pageHeight - item.transform[5]; // Convert from bottom-up to top-down
    const w = item.width || item.str.length * 6;
    const h = item.height || 12;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y - h); // text baseline adjustment
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y);
  }

  // Add padding
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(pageWidth, maxX + pad);
  maxY = Math.min(pageHeight, maxY + pad);

  // Normalize to 0-1
  return {
    x: minX / pageWidth,
    y: minY / pageHeight,
    width: (maxX - minX) / pageWidth,
    height: (maxY - minY) / pageHeight,
  };
}

/**
 * Extract text from specific highlighted regions on a page.
 * Uses spatial matching against pdfjs text items.
 */
export async function extractFromRegions(
  file: File,
  highlights: { page: number; field: string; x: number; y: number; width: number; height: number }[],
): Promise<ExtractedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const results: ExtractedRow[] = [];

  // Group highlights by page
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

    // Log text items for debugging
    console.log(`Page ${pageNum}: ${content.items.length} text items, viewport: ${pageWidth}x${pageHeight}`);

    for (const hl of pageHighlights) {
      // Convert highlight coords (0-1 normalized) to PDF coords
      const hlLeft = hl.x * pageWidth;
      const hlRight = (hl.x + hl.width) * pageWidth;
      const hlTop = hl.y * pageHeight;
      const hlBottom = (hl.y + hl.height) * pageHeight;

      console.log(`Highlight "${hl.field}": normalized(${hl.x.toFixed(3)}, ${hl.y.toFixed(3)}, ${hl.width.toFixed(3)}, ${hl.height.toFixed(3)}) => PDF(${hlLeft.toFixed(1)}, ${hlTop.toFixed(1)} - ${hlRight.toFixed(1)}, ${hlBottom.toFixed(1)})`);

      const matchedTexts: string[] = [];

      for (const item of content.items as any[]) {
        if (!item.str || !item.transform) continue;

        // PDF text items: transform[4] = x, transform[5] = y (from bottom-left)
        const itemX = item.transform[4];
        // Convert Y from bottom-up to top-down coordinate system
        const itemBaseline = pageHeight - item.transform[5];
        const itemHeight = item.height || Math.abs(item.transform[3]) || 12;
        const itemWidth = item.width || item.str.length * 6;
        
        // The baseline is at the bottom of the text, so top = baseline - height
        const itemTop = itemBaseline - itemHeight;
        const itemBottom = itemBaseline;
        const itemRight = itemX + itemWidth;

        // Check if the text item overlaps with the highlight region
        // Use generous overlap - any intersection counts
        const overlapX = hlRight > itemX && hlLeft < itemRight;
        const overlapY = hlBottom > itemTop && hlTop < itemBottom;

        if (overlapX && overlapY) {
          matchedTexts.push(item.str);
        }
      }

      const value = matchedTexts.join(' ').replace(/\s+/g, ' ').trim() || null;
      
      console.log(`  => Matched ${matchedTexts.length} items: "${value}"`);

      results.push({
        page: hl.page,
        field: hl.field,
        value,
        confidence: value && value.length > 2 ? 'high' : value ? 'medium' : 'low',
        wasOcr: false,
      });
    }
  }

  return results;
}

/**
 * Legacy auto-extract (without highlights). Kept for backward compat.
 */
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
          confidence = pi === 0 ? 'high' : pi === 1 ? 'high' : 'medium';
          break;
        }
      }

      pageResults[field] = { value: found, confidence };
    }

    if (pageResults.property_name.value) {
      lastPropertyName = pageResults.property_name.value;
    } else if (lastPropertyName) {
      pageResults.property_name = { value: lastPropertyName, confidence: 'medium' };
    }

    if (pageResults.account_number.value) {
      lastAccountNumber = pageResults.account_number.value;
    } else if (lastAccountNumber) {
      pageResults.account_number = { value: lastAccountNumber, confidence: 'medium' };
    }

    if (pageResults.address.value) {
      lastAddress = pageResults.address.value;
    } else if (lastAddress) {
      pageResults.address = { value: lastAddress, confidence: 'medium' };
    }

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
