/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from 'xlsx';
import type { ExtractedRow } from '@/types/utilscraper';

// ---------------------------------------------------------------------------
// Colours matching the Recon/Rollup template
// ---------------------------------------------------------------------------
const C = {
  navyBg:      '1E3A5F',   // section headers + year column + property header
  navyText:    'FFFFFF',
  sectionBg:   '1E3A5F',   // Utility Bills / Operating Statement / Variance
  yearColBg:   '1E3A5F',   // 2024, 2025 year total columns
  propNameBg:  'D6E4F0',   // light blue for property name row
  propNameText:'1E3A5F',
  totalRowBg:  'E8F0FE',   // Total Utilities / total rows
  totalRowFont:'1E3A5F',
  whiteBg:     'FFFFFF',
  lightGray:   'F5F5F5',
  nullCell:    'FFE0E0',
  borderColor: '8EA9C1',
};

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------
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
    alignment: { horizontal: align, vertical: 'center' },
    border:    thinBorder(),
  };
}

function thinBorder(): any {
  const s = { style: 'thin', color: { rgb: C.borderColor } };
  return { top: s, bottom: s, left: s, right: s };
}

// ---------------------------------------------------------------------------
// Date parsing helpers
// ---------------------------------------------------------------------------
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseMonthYear(dateStr: string | null | undefined): { month: number; year: number } | null {
  if (!dateStr) return null;
  // Try "Nov 6, 2024" or "Dec 9, 2024" or "Jan 11, 2025"
  const m1 = dateStr.match(/([A-Za-z]{3})[\s.,]+(\d{1,2})[,\s]+(\d{4})/);
  if (m1) {
    const mi = MONTHS.findIndex(m => m.toLowerCase() === m1[1].toLowerCase());
    if (mi >= 0) return { month: mi + 1, year: parseInt(m1[3]) };
  }
  // Try "MM/DD/YYYY"
  const m2 = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) return { month: parseInt(m2[1]), year: parseInt(m2[3]) };
  return null;
}

function monthKey(month: number, year: number): string {
  return `${MONTHS[month - 1]}-${String(year).slice(2)}`;
}

function monthLabel(month: number, year: number): string {
  return `${MONTHS[month - 1]}-${String(year).slice(2)}`;
}

// Generate all months between two dates (inclusive)
function generateMonthRange(
  start: { month: number; year: number },
  end: { month: number; year: number },
): { month: number; year: number }[] {
  const result: { month: number; year: number }[] = [];
  let cur = { ...start };
  while (cur.year < end.year || (cur.year === end.year && cur.month <= end.month)) {
    result.push({ ...cur });
    cur.month++;
    if (cur.month > 12) { cur.month = 1; cur.year++; }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------
export function exportToExcel(
  data: ExtractedRow[],
  filename: string,
  provider: string,
) {
  const now     = new Date();
  const dateStr = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');

  // ------------------------------------------------------------------
  // 1. Group by property name
  // ------------------------------------------------------------------
  const propMap = new Map<string, ExtractedRow[]>();
  for (const row of data) {
    const propName = data.find(d => d.page === row.page && d.field === 'property_name')?.value
      || 'Unknown Property';
    if (!propMap.has(propName)) propMap.set(propName, []);
    const existing = propMap.get(propName)!;
    if (!existing.find(e => e.page === row.page && e.field === row.field)) {
      existing.push(row);
    }
  }

  // ------------------------------------------------------------------
  // 2. Build month columns from all billing dates
  // ------------------------------------------------------------------
  const allDates: { month: number; year: number }[] = [];
  for (const row of data) {
    if (row.field === 'billing_date' || row.field === 'billing_date_start') {
      const parsed = parseMonthYear(row.value);
      if (parsed) allDates.push(parsed);
    }
  }

  let monthRange: { month: number; year: number }[] = [];
  if (allDates.length > 0) {
    const minYear  = Math.min(...allDates.map(d => d.year));
    const maxYear  = Math.max(...allDates.map(d => d.year));
    const minMonth = Math.min(...allDates.filter(d => d.year === minYear).map(d => d.month));
    const maxMonth = Math.max(...allDates.filter(d => d.year === maxYear).map(d => d.month));
    monthRange = generateMonthRange(
      { month: minMonth, year: minYear },
      { month: maxMonth, year: maxYear },
    );
  } else {
    // Fallback: last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthRange.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }
  }

  // Get unique years to insert year-total columns
  const years = [...new Set(monthRange.map(m => m.year))].sort();

  // Build final column list: months + year totals + TM + Comments
  type ColDef =
    | { type: 'month'; month: number; year: number; label: string; key: string }
    | { type: 'yearTotal'; year: number; label: string }
    | { type: 'tm'; label: string }
    | { type: 'comments'; label: string };

  const columns: ColDef[] = [];
  for (const yr of years) {
    const mths = monthRange.filter(m => m.year === yr);
    for (const m of mths) {
      columns.push({ type: 'month', ...m, label: monthLabel(m.month, m.year), key: monthKey(m.month, m.year) });
    }
    columns.push({ type: 'yearTotal', year: yr, label: String(yr) });
  }
  columns.push({ type: 'tm',       label: `TM ${MONTHS[now.getMonth()]}-${String(now.getFullYear()).slice(2)}` });
  columns.push({ type: 'comments', label: 'Comments' });

  const DATA_COL_START = 2; // Column B onwards (0-indexed: A=label, B=first month)
  const totalCols      = DATA_COL_START + columns.length;

  // ------------------------------------------------------------------
  // 3. Build workbook data row by row
  // ------------------------------------------------------------------
  const wsData: any[][] = [];
  const styles: { row: number; col: number; style: any }[] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const colWidths: { wch: number }[] = [];

  let rowIdx = 0;

  function pushRow(cells: any[]) {
    wsData.push(cells);
    return rowIdx++;
  }

  function styleCell(r: number, c: number, style: any) {
    styles.push({ row: r, col: c, style });
  }

  function styleRange(r: number, cStart: number, cEnd: number, style: any) {
    for (let c = cStart; c <= cEnd; c++) styleCell(r, c, style);
  }

  function mergeRange(r: number, c1: number, c2: number) {
    merges.push({ s: { r, c: c1 }, e: { r, c: c2 } });
  }

  // ------------------------------------------------------------------
  // Helper: get gas bill value for a specific page + month
  // ------------------------------------------------------------------
  function getGasValue(rows: ExtractedRow[], targetKey: string): string | null {
    for (const row of rows) {
      if (row.field !== 'total_gas_bill' && row.field !== 'billing_date'
          && row.field !== 'billing_date_start') continue;
      if (row.field === 'total_gas_bill') {
        // Find the billing date for this page
        const dateRow = rows.find(r => r.page === row.page
          && (r.field === 'billing_date' || r.field === 'billing_date_start'));
        if (dateRow) {
          const parsed = parseMonthYear(dateRow.value);
          if (parsed && monthKey(parsed.month, parsed.year) === targetKey) {
            return row.value;
          }
        }
      }
    }
    return null;
  }

  function parseAmount(val: string | null): number {
    if (!val) return 0;
    return parseFloat(val.replace(/[$,]/g, '')) || 0;
  }

  // ------------------------------------------------------------------
  // Row for utility types
  // ------------------------------------------------------------------
  const UTIL_TYPES = [
    { key: 'gas',      label: 'Total Gas',       isExtracted: true  },
    { key: 'water',    label: 'Total Water',      isExtracted: false },
    { key: 'sewerage', label: 'Total Sewerage',   isExtracted: false },
    { key: 'electric', label: 'Total Electric',   isExtracted: false },
    { key: 'trash',    label: 'Total Trash',      isExtracted: false },
  ];

  // ------------------------------------------------------------------
  // 4. TOP HEADER ROW — Column labels
  // ------------------------------------------------------------------
  {
    const headerRow: any[] = ['', ''];  // A1 blank, B1 blank (label col)
    for (const col of columns) headerRow.push(col.label);
    const r = pushRow(headerRow);
    styleCell(r, 0, hdr(C.navyBg, C.navyText, true, 9));
    styleCell(r, 1, hdr(C.navyBg, C.navyText, true, 9));
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci];
      const isYear = col.type === 'yearTotal';
      const isTm   = col.type === 'tm';
      const bg     = isYear || isTm ? C.yearColBg : C.navyBg;
      styleCell(r, DATA_COL_START + ci, hdr(bg, C.navyText, true, 9));
    }
    rowIdx = r + 1;
  }

  // ------------------------------------------------------------------
  // 5. One block per property
  // ------------------------------------------------------------------
  for (const [propName, propRows] of propMap.entries()) {
    // Account number and address for this property
    const acct    = propRows.find(r => r.field === 'account_number')?.value  || '';
    const address = propRows.find(r => r.field === 'address')?.value         || '';

    // ---- Property name header ----
    {
      const cells: any[] = [propName, `Acct: ${acct}`, ...columns.map(() => '')];
      const r = pushRow(cells);
      styleCell(r, 0, { ...cell(C.propNameBg, true, 'left', 10), font: { bold: true, color: { rgb: C.propNameText }, sz: 10, underline: true } });
      styleCell(r, 1, cell(C.propNameBg, false, 'left', 9));
      styleRange(r, DATA_COL_START, DATA_COL_START + columns.length - 1, cell(C.propNameBg));
      if (address) {
        wsData[r][1] = `${acct}  |  ${address}`;
      }
    }

    // ---- Three sections ----
    const SECTIONS = [
      { label: 'Utility Bills',        hasData: true  },
      { label: 'Operating Statement',  hasData: false },
      { label: 'Variance',             hasData: false },
    ];

    for (const section of SECTIONS) {
      // Section header row
      {
        const cells: any[] = [section.label, '', ...columns.map(c => c.type === 'yearTotal' ? String(c.year) : c.type === 'tm' ? c.label : c.label)];
        const r = pushRow(cells);
        mergeRange(r, 0, 1);
        styleCell(r, 0, hdr(C.sectionBg, C.navyText, true, 10));
        styleCell(r, 1, hdr(C.sectionBg, C.navyText, true, 10));
        for (let ci = 0; ci < columns.length; ci++) {
          const col = columns[ci];
          const isYear = col.type === 'yearTotal';
          const isTm   = col.type === 'tm';
          const bg     = isYear || isTm ? C.yearColBg : C.sectionBg;
          styleCell(r, DATA_COL_START + ci, hdr(bg, C.navyText, true, 9));
        }
      }

      // Utility type rows
      const utilTotals: Record<string, number[]> = {}; // key → monthly values
      for (const col of columns) {
        if (col.type === 'month') {
          const colKey = (col as any).key;
          utilTotals[colKey] = [];
        }
      }

      for (const ut of UTIL_TYPES) {
        const rowCells: any[] = [ut.label, ''];
        let rowTotal = 0;

        for (const col of columns) {
          if (col.type === 'month') {
            const colKey = (col as any).key;
            let val: string | null = null;
            if (section.hasData && ut.isExtracted) {
              val = getGasValue(propRows, colKey);
            }
            const amount = parseAmount(val);
            rowTotal += amount;
            if (!utilTotals[colKey]) utilTotals[colKey] = [];
            utilTotals[colKey].push(amount);
            rowCells.push(val ? `$${amount.toFixed(2)}` : '');
          } else if (col.type === 'yearTotal') {
            // Sum of months in this year for this util type
            const yr     = (col as any).year;
            const mths   = monthRange.filter(m => m.year === yr);
            let   yTotal = 0;
            if (section.hasData && ut.isExtracted) {
              for (const m of mths) {
                const v = getGasValue(propRows, monthKey(m.month, m.year));
                yTotal += parseAmount(v);
              }
            }
            rowCells.push(yTotal > 0 ? `$${yTotal.toFixed(2)}` : '');
          } else if (col.type === 'tm') {
            // Trailing month = most recent month with data
            const latestMonth = monthRange[monthRange.length - 1];
            let   tmVal: string | null = null;
            if (section.hasData && ut.isExtracted && latestMonth) {
              tmVal = getGasValue(propRows, monthKey(latestMonth.month, latestMonth.year));
            }
            rowCells.push(tmVal ? `$${parseAmount(tmVal).toFixed(2)}` : '');
          } else {
            rowCells.push(''); // Comments
          }
        }

        const r = pushRow(rowCells);
        const isTotal = ut.key === 'electric'; // example: last row before total utilities
        const bg = C.whiteBg;
        styleCell(r, 0, cell(bg, false, 'left', 9));
        styleCell(r, 1, cell(bg, false, 'left', 9));
        for (let ci = 0; ci < columns.length; ci++) {
          const col = columns[ci];
          const isYear = col.type === 'yearTotal';
          const isTm   = col.type === 'tm';
          const isCmt  = col.type === 'comments';
          const cellBg = isYear || isTm ? 'EAF0FB' : isCmt ? 'FAFAFA' : bg;
          styleCell(r, DATA_COL_START + ci, cell(cellBg, false, 'right', 9));
        }
      }

      // Total Utilities row
      {
        const totalCells: any[] = ['Total Utilities', ''];
        for (const col of columns) {
          if (col.type === 'month') {
            const colKey = (col as any).key;
            const monthTotal = (utilTotals[colKey] || []).reduce((a, b) => a + b, 0);
            totalCells.push(monthTotal > 0 ? `$${monthTotal.toFixed(2)}` : '$0.00');
          } else if (col.type === 'yearTotal') {
            const yr   = (col as any).year;
            const mths = monthRange.filter(m => m.year === yr);
            let   yt   = 0;
            for (const m of mths) {
              const v = section.hasData
                ? getGasValue(propRows, monthKey(m.month, m.year))
                : null;
              yt += parseAmount(v);
            }
            totalCells.push(yt > 0 ? `$${yt.toFixed(2)}` : '$0.00');
          } else if (col.type === 'tm') {
            const latestMonth = monthRange[monthRange.length - 1];
            const v = section.hasData && latestMonth
              ? getGasValue(propRows, monthKey(latestMonth.month, latestMonth.year))
              : null;
            totalCells.push(v ? `$${parseAmount(v).toFixed(2)}` : '$0.00');
          } else {
            totalCells.push('');
          }
        }
        const r = pushRow(totalCells);
        styleCell(r, 0, { ...cell(C.totalRowBg, true, 'left', 9), font: { bold: true, color: { rgb: C.totalRowFont }, sz: 9 } });
        styleCell(r, 1, cell(C.totalRowBg, true, 'left', 9));
        for (let ci = 0; ci < columns.length; ci++) {
          const col = columns[ci];
          const isYear = col.type === 'yearTotal';
          const isTm   = col.type === 'tm';
          const bg     = isYear || isTm ? 'C5D9F1' : C.totalRowBg;
          styleCell(r, DATA_COL_START + ci, { ...cell(bg, true, 'right', 9), font: { bold: true, color: { rgb: C.totalRowFont }, sz: 9 } });
        }
      }
    }

    // Spacer row between properties
    pushRow(new Array(totalCols).fill(''));
  }

  // ------------------------------------------------------------------
  // 6. Build worksheet
  // ------------------------------------------------------------------
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Apply styles
  for (const { row, col, style } of styles) {
    const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
    if (!ws[cellRef]) ws[cellRef] = { t: 's', v: wsData[row]?.[col] ?? '' };
    ws[cellRef].s = style;
  }

  // Merges
  ws['!merges'] = merges;

  // Column widths: A = row label (22), B = acct/addr (28), rest = 10 each
  const wscols: { wch: number }[] = [
    { wch: 22 },  // A: row label
    { wch: 28 },  // B: account/address
  ];
  for (const col of columns) {
    if (col.type === 'yearTotal') wscols.push({ wch: 10 });
    else if (col.type === 'tm')       wscols.push({ wch: 11 });
    else if (col.type === 'comments') wscols.push({ wch: 20 });
    else                               wscols.push({ wch: 9 });
  }
  ws['!cols'] = wscols;

  // Freeze top header row
  ws['!freeze'] = { xSplit: 2, ySplit: 1 };

  // ------------------------------------------------------------------
  // 7. Save
  // ------------------------------------------------------------------
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Recon Roll-Up');

  const xlsxName = `UtilScraper_Recon_${provider.replace(/\s+/g, '')}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, xlsxName);
}