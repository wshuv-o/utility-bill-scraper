/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from 'xlsx';
import type { ExtractedRow } from '@/types/utilscraper';
import { getFieldLabelsForType, DOCUMENT_TYPES, type DocumentType } from '@/types/utilscraper';

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------
const C = {
  navyBg:      '1E3A5F',
  navyText:    'FFFFFF',
  whiteBg:     'FFFFFF',
  borderColor: '8EA9C1',
};

function hdr(bg: string, font: string, bold = true, sz = 10): any {
  return {
    font:      { bold, color: { rgb: font }, sz },
    fill:      { fgColor: { rgb: bg } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border:    thinBorder(),
  };
}

function cell(bg: string, bold = false, align: 'left' | 'center' | 'right' = 'left', sz = 9): any {
  return {
    font:      { bold, color: { rgb: '000000' }, sz },
    fill:      { fgColor: { rgb: bg } },
    alignment: { horizontal: align, vertical: 'center', wrapText: true },
    border:    thinBorder(),
  };
}

function thinBorder(): any {
  const s = { style: 'thin', color: { rgb: C.borderColor } };
  return { top: s, bottom: s, left: s, right: s };
}

function applyStyles(
  ws: XLSX.WorkSheet,
  wsData: any[][],
  styles: { row: number; col: number; style: any }[],
) {
  for (const { row, col, style } of styles) {
    const ref = XLSX.utils.encode_cell({ r: row, c: col });
    if (!ws[ref]) ws[ref] = { t: 's', v: wsData[row]?.[col] ?? '' };
    ws[ref].s = style;
  }
}

// ---------------------------------------------------------------------------
// Group rows by filename
// ---------------------------------------------------------------------------
function groupByFile(data: ExtractedRow[]): Map<string, ExtractedRow[]> {
  const map = new Map<string, ExtractedRow[]>();
  for (const row of data) {
    const key = row.filename || 'Unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Build a sheet for a given document type
//
// Layout:
//   Row 0 (header): "File Name" | field1 label | field2 label | ...
//   Row 1+:         filename    | value         | value        | ...
//
// One row per file. If a file has the same field extracted multiple times
// (e.g. from different pages), values are joined with " | ".
// ---------------------------------------------------------------------------
function buildSheetForType(
  docType: DocumentType,
  data: ExtractedRow[],
): XLSX.WorkSheet | null {
  const fileMap = groupByFile(data);
  if (fileMap.size === 0) return null;

  // Get field columns for this doc type (exclude 'custom')
  const fieldDefs = getFieldLabelsForType(docType).filter(f => f.value !== 'custom');

  // Collect any custom field names used in the data
  const knownFields = new Set(fieldDefs.map(f => f.value as string));
  const customFields: string[] = [];
  for (const row of data) {
    if (!knownFields.has(row.field) && !customFields.includes(row.field)) {
      customFields.push(row.field);
    }
  }

  // All column keys: known fields + custom fields
  const allColumns = [
    ...fieldDefs.map(f => ({ key: f.value, label: f.label })),
    ...customFields.map(f => ({ key: f, label: f })),
  ];

  const wsData: any[][] = [];
  const styles: { row: number; col: number; style: any }[] = [];
  let ri = 0;
  const push = (cells: any[]) => { wsData.push(cells); return ri++; };
  const sc = (r: number, c: number, s: any) => styles.push({ row: r, col: c, style: s });

  // Header row
  const headerCells = ['File Name', ...allColumns.map(c => c.label)];
  const r0 = push(headerCells);
  for (let c = 0; c < headerCells.length; c++) {
    sc(r0, c, hdr(C.navyBg, C.navyText));
  }

  // Data rows — one per file
  for (const [filename, rows] of fileMap.entries()) {
    // Build a map: field → collected values (join multiples)
    const valMap: Record<string, string[]> = {};
    for (const row of rows) {
      if (row.value) {
        if (!valMap[row.field]) valMap[row.field] = [];
        if (!valMap[row.field].includes(row.value)) {
          valMap[row.field].push(row.value);
        }
      }
    }

    const rowCells = [
      filename.replace(/\.pdf$/i, ''),
      ...allColumns.map(col => {
        const vals = valMap[col.key];
        return vals ? vals.join(' | ') : '';
      }),
    ];

    const r = push(rowCells);
    const bg = ri % 2 === 0 ? 'F0F4FF' : C.whiteBg;
    sc(r, 0, cell(bg, true, 'left', 9));
    for (let c = 1; c < rowCells.length; c++) {
      sc(r, c, cell(bg, false, 'left', 9));
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  applyStyles(ws, wsData, styles);
  ws['!cols'] = [
    { wch: 30 },
    ...allColumns.map(() => ({ wch: 22 })),
  ];
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };
  return ws;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function exportToExcel(
  data: ExtractedRow[],
  _filename: string,
  provider: string,
) {
  const now     = new Date();
  const dateStr = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');
  const wb      = XLSX.utils.book_new();

  // Group data by document type via sessionId → docType mapping isn't available here,
  // so we infer doc type from the fields present in each file's rows.
  const fileMap = groupByFile(data);
  const typeFiles: Record<DocumentType, ExtractedRow[]> = {
    utility_bill: [],
    bank_statement: [],
    appraisal: [],
    lease_contract: [],
  };

  // Build field→docType lookup
  const fieldToType: Record<string, DocumentType> = {};
  for (const dt of DOCUMENT_TYPES) {
    for (const f of getFieldLabelsForType(dt.value)) {
      if (f.value !== 'custom') fieldToType[f.value] = dt.value;
    }
  }

  for (const [filename, rows] of fileMap.entries()) {
    // Detect type from the majority of fields
    const typeCounts: Record<string, number> = {};
    for (const row of rows) {
      const dt = fieldToType[row.field];
      if (dt) typeCounts[dt] = (typeCounts[dt] || 0) + 1;
    }
    const detected = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as DocumentType | undefined;
    const docType = detected || 'utility_bill';
    typeFiles[docType].push(...rows);
  }

  // Create one sheet per document type that has data
  const sheetNames: Record<DocumentType, string> = {
    utility_bill:   'Utility Bills',
    bank_statement: 'Bank Statements',
    appraisal:      'Appraisals',
    lease_contract: 'Lease Contracts',
  };

  let sheetCount = 0;
  for (const dt of DOCUMENT_TYPES) {
    const typeData = typeFiles[dt.value];
    if (typeData.length === 0) continue;
    const ws = buildSheetForType(dt.value, typeData);
    if (ws) {
      XLSX.utils.book_append_sheet(wb, ws, sheetNames[dt.value]);
      sheetCount++;
    }
  }

  if (sheetCount === 0) {
    // Fallback: single sheet with all data
    const ws = buildSheetForType('utility_bill', data);
    if (ws) XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');
  }

  XLSX.writeFile(wb, `UtilScraper_${provider.replace(/\s+/g, '')}_${dateStr}.xlsx`);
}
