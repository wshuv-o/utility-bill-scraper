/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from 'xlsx';
import type { ExtractedRow } from '@/types/utilscraper';

const C = {
  navyBg:      '1E3A5F',
  navyText:    'FFFFFF',
  sectionBg:   '1E3A5F',
  yearColBg:   '1E3A5F',
  propNameBg:  'D6E4F0',
  propNameText:'1E3A5F',
  totalRowBg:  'E8F0FE',
  totalRowFont:'1E3A5F',
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
    alignment: { horizontal: align, vertical: 'center' },
    border:    thinBorder(),
  };
}

function thinBorder(): any {
  const s = { style: 'thin', color: { rgb: C.borderColor } };
  return { top: s, bottom: s, left: s, right: s };
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const FULL_MONTHS = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december',
];

function parseMonthYear(dateStr: string | null | undefined): { month: number; year: number } | null {
  if (!dateStr) return null;
  const s = dateStr.trim();

  // "Jan 15, 2025" / "Mar. 6 2025" (abbreviated month name)
  const m1 = s.match(/([A-Za-z]{3,9})[\s.,]+(\d{1,2})[,\s]+(\d{4})/);
  if (m1) {
    const name = m1[1].toLowerCase();
    let mi = MONTHS.findIndex(m => m.toLowerCase() === name);
    if (mi < 0) mi = FULL_MONTHS.findIndex(m => m === name);
    if (mi >= 0) return { month: mi + 1, year: parseInt(m1[3]) };
  }

  // MM/DD/YYYY or MM-DD-YYYY or MM.DD.YYYY
  const m2 = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (m2) return { month: parseInt(m2[1]), year: parseInt(m2[3]) };

  // YYYY-MM-DD (ISO format)
  const m3 = s.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (m3) return { month: parseInt(m3[2]), year: parseInt(m3[1]) };

  // "15 January 2025" / "6 Mar 2025" (day before month name)
  const m4 = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})[,\s]+(\d{4})/);
  if (m4) {
    const name = m4[2].toLowerCase();
    let mi = MONTHS.findIndex(m => m.toLowerCase() === name);
    if (mi < 0) mi = FULL_MONTHS.findIndex(m => m === name);
    if (mi >= 0) return { month: mi + 1, year: parseInt(m4[3]) };
  }

  return null;
}

// monthLabel was identical to monthKey — removed duplicate
function monthKey(month: number, year: number): string {
  return `${MONTHS[month - 1]}-${String(year).slice(2)}`;
}

function generateMonthRange(
  start: { month: number; year: number },
  end:   { month: number; year: number },
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

type ColDef =
  | { type: 'month';     month: number; year: number; label: string; key: string }
  | { type: 'yearTotal'; year: number;  label: string }
  | { type: 'tm';        label: string }
  | { type: 'comments';  label: string };

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

function parseAmount(val: string | null | undefined): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[$,]/g, '')) || 0;
}

function getGasValue(rows: ExtractedRow[], targetKey: string): string | null {
  for (const row of rows) {
    if (row.field !== 'total_gas_bill') continue;
    const dateRow = rows.find(
      r => r.page === row.page &&
        (r.field === 'billing_date' || r.field === 'billing_date_start'),
    );
    if (dateRow) {
      const parsed = parseMonthYear(dateRow.value);
      if (parsed && monthKey(parsed.month, parsed.year) === targetKey) return row.value;
    }
  }
  return null;
}

function buildColumns(data: ExtractedRow[], now: Date) {
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
    monthRange = generateMonthRange({ month: minMonth, year: minYear }, { month: maxMonth, year: maxYear });
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthRange.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }
  }

  const years = [...new Set(monthRange.map(m => m.year))].sort();
  const columns: ColDef[] = [];
  for (const yr of years) {
    for (const m of monthRange.filter(m => m.year === yr)) {
      columns.push({ type: 'month', ...m, label: monthKey(m.month, m.year), key: monthKey(m.month, m.year) });
    }
    columns.push({ type: 'yearTotal', year: yr, label: String(yr) });
  }
  columns.push({ type: 'tm',       label: `TM ${MONTHS[now.getMonth()]}-${String(now.getFullYear()).slice(2)}` });
  columns.push({ type: 'comments', label: 'Comments' });
  return { columns, monthRange, years };
}

function groupByProperty(data: ExtractedRow[]): Map<string, ExtractedRow[]> {
  const propMap = new Map<string, ExtractedRow[]>();
  for (const row of data) {
    const propName = data.find(d => d.page === row.page && d.field === 'property_name')?.value || 'Unknown Property';
    if (!propMap.has(propName)) propMap.set(propName, []);
    const existing = propMap.get(propName)!;
    if (!existing.find(e => e.page === row.page && e.field === row.field)) existing.push(row);
  }
  return propMap;
}

const UTIL_TYPES = [
  { key: 'gas',      label: 'Total Gas',     isExtracted: true  },
  { key: 'water',    label: 'Total Water',    isExtracted: false },
  { key: 'sewerage', label: 'Total Sewerage', isExtracted: false },
  { key: 'electric', label: 'Total Electric', isExtracted: false },
  { key: 'trash',    label: 'Total Trash',    isExtracted: false },
];

const SECTIONS = [
  { label: 'Utility Bills',       hasData: true  },
  { label: 'Operating Statement', hasData: false },
  { label: 'Variance',            hasData: false },
];

function colWidths(columns: ColDef[]): { wch: number }[] {
  return [
    { wch: 22 }, { wch: 30 },
    ...columns.map(c =>
      c.type === 'yearTotal' ? { wch: 11 } :
      c.type === 'tm'        ? { wch: 11 } :
      c.type === 'comments'  ? { wch: 20 } : { wch: 9 }
    ),
  ];
}

// ---------------------------------------------------------------------------
// RECON sheet — detailed per-property with all three sections
// ---------------------------------------------------------------------------
function buildReconSheet(
  propMap: Map<string, ExtractedRow[]>,
  columns: ColDef[],
  monthRange: { month: number; year: number }[],
): XLSX.WorkSheet {
  const wsData:  any[][] = [];
  const styles:  { row: number; col: number; style: any }[] = [];
  const merges:  { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const D = 2; // DATA_COL_START
  let ri = 0;

  const push = (cells: any[]) => { wsData.push(cells); return ri++; };
  const sc   = (r: number, c: number, s: any) => styles.push({ row: r, col: c, style: s });
  const sr   = (r: number, c1: number, c2: number, s: any) => { for (let c = c1; c <= c2; c++) sc(r, c, s); };
  const mr   = (r: number, c1: number, c2: number) => merges.push({ s: { r, c: c1 }, e: { r, c: c2 } });

  // Header row
  {
    const r = push(['', '', ...columns.map(c => c.label)]);
    sc(r, 0, hdr(C.navyBg, C.navyText));
    sc(r, 1, hdr(C.navyBg, C.navyText));
    for (let ci = 0; ci < columns.length; ci++) {
      const bg = columns[ci].type === 'yearTotal' || columns[ci].type === 'tm' ? C.yearColBg : C.navyBg;
      sc(r, D + ci, hdr(bg, C.navyText));
    }
  }

  for (const [propName, propRows] of propMap.entries()) {
    const acct    = propRows.find(r => r.field === 'account_number')?.value || '';
    const address = propRows.find(r => r.field === 'address')?.value || '';

    // Property row
    {
      const r = push([propName, acct && address ? `${acct}  |  ${address}` : acct || address, ...columns.map(() => '')]);
      sc(r, 0, { font: { bold: true, color: { rgb: C.propNameText }, sz: 10, underline: true }, fill: { fgColor: { rgb: C.propNameBg } }, alignment: { horizontal: 'left', vertical: 'center' }, border: thinBorder() });
      sc(r, 1, cell(C.propNameBg, false, 'left', 9));
      sr(r, D, D + columns.length - 1, cell(C.propNameBg));
    }

    for (const section of SECTIONS) {
      // Section header
      {
        const r = push([section.label, '', ...columns.map(c => c.type === 'yearTotal' ? String((c as any).year) : c.label)]);
        mr(r, 0, 1);
        sc(r, 0, hdr(C.sectionBg, C.navyText, true, 10));
        sc(r, 1, hdr(C.sectionBg, C.navyText, true, 10));
        for (let ci = 0; ci < columns.length; ci++) {
          const bg = columns[ci].type === 'yearTotal' || columns[ci].type === 'tm' ? C.yearColBg : C.sectionBg;
          sc(r, D + ci, hdr(bg, C.navyText));
        }
      }

      const utilTotals: Record<string, number> = {};

      for (const ut of UTIL_TYPES) {
        const rowCells: any[] = [ut.label, ''];
        for (const col of columns) {
          if (col.type === 'month') {
            const k   = (col as any).key;
            const val = section.hasData && ut.isExtracted ? getGasValue(propRows, k) : null;
            const amt = parseAmount(val);
            utilTotals[k] = (utilTotals[k] || 0) + amt;
            rowCells.push(val ? `$${amt.toFixed(2)}` : '');
          } else if (col.type === 'yearTotal') {
            const yr = (col as any).year;
            let yt = 0;
            if (section.hasData && ut.isExtracted)
              for (const m of monthRange.filter(m => m.year === yr))
                yt += parseAmount(getGasValue(propRows, monthKey(m.month, m.year)));
            rowCells.push(yt > 0 ? `$${yt.toFixed(2)}` : '');
          } else if (col.type === 'tm') {
            const latest = monthRange[monthRange.length - 1];
            const v = section.hasData && ut.isExtracted && latest ? getGasValue(propRows, monthKey(latest.month, latest.year)) : null;
            rowCells.push(v ? `$${parseAmount(v).toFixed(2)}` : '');
          } else { rowCells.push(''); }
        }
        const r = push(rowCells);
        sc(r, 0, cell(C.whiteBg, false, 'left', 9));
        sc(r, 1, cell(C.whiteBg));
        for (let ci = 0; ci < columns.length; ci++) {
          const bg = columns[ci].type === 'yearTotal' || columns[ci].type === 'tm' ? 'EAF0FB' : columns[ci].type === 'comments' ? 'FAFAFA' : C.whiteBg;
          sc(r, D + ci, cell(bg, false, 'right', 9));
        }
      }

      // Total Utilities row
      {
        const totalCells: any[] = ['Total Utilities', ''];
        for (const col of columns) {
          if (col.type === 'month') {
            const t = utilTotals[(col as any).key] || 0;
            totalCells.push(`$${t.toFixed(2)}`);
          } else if (col.type === 'yearTotal') {
            let yt = 0;
            if (section.hasData)
              for (const m of monthRange.filter(m => m.year === (col as any).year))
                yt += parseAmount(getGasValue(propRows, monthKey(m.month, m.year)));
            totalCells.push(`$${yt.toFixed(2)}`);
          } else if (col.type === 'tm') {
            const latest = monthRange[monthRange.length - 1];
            const v = section.hasData && latest ? getGasValue(propRows, monthKey(latest.month, latest.year)) : null;
            totalCells.push(`$${parseAmount(v).toFixed(2)}`);
          } else { totalCells.push(''); }
        }
        const r = push(totalCells);
        sc(r, 0, { font: { bold: true, color: { rgb: C.totalRowFont }, sz: 9 }, fill: { fgColor: { rgb: C.totalRowBg } }, alignment: { horizontal: 'left', vertical: 'center' }, border: thinBorder() });
        sc(r, 1, cell(C.totalRowBg, true));
        for (let ci = 0; ci < columns.length; ci++) {
          const bg = columns[ci].type === 'yearTotal' || columns[ci].type === 'tm' ? 'C5D9F1' : C.totalRowBg;
          sc(r, D + ci, { font: { bold: true, color: { rgb: C.totalRowFont }, sz: 9 }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thinBorder() });
        }
      }
    }
    push(new Array(D + columns.length).fill(''));
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  applyStyles(ws, wsData, styles);
  ws['!merges'] = merges;
  ws['!cols']   = colWidths(columns);
  ws['!freeze'] = { xSplit: 2, ySplit: 1 };
  return ws;
}

// ---------------------------------------------------------------------------
// ROLL-UP sheet — one row per property, monthly gas totals summary
// ---------------------------------------------------------------------------
function buildRollUpSheet(
  propMap: Map<string, ExtractedRow[]>,
  columns: ColDef[],
  monthRange: { month: number; year: number }[],
): XLSX.WorkSheet {
  const wsData:  any[][] = [];
  const styles:  { row: number; col: number; style: any }[] = [];
  const D = 2;
  let ri = 0;

  const push = (cells: any[]) => { wsData.push(cells); return ri++; };
  const sc   = (r: number, c: number, s: any) => styles.push({ row: r, col: c, style: s });

  // Header
  {
    const r = push(['Property Name', 'Account Number', ...columns.map(c => c.label)]);
    sc(r, 0, hdr(C.navyBg, C.navyText));
    sc(r, 1, hdr(C.navyBg, C.navyText));
    for (let ci = 0; ci < columns.length; ci++) {
      const bg = columns[ci].type === 'yearTotal' || columns[ci].type === 'tm' ? C.yearColBg : C.navyBg;
      sc(r, D + ci, hdr(bg, C.navyText));
    }
  }

  const grandTotals: Record<string, number> = {};

  for (const [propName, propRows] of propMap.entries()) {
    const acct = propRows.find(r => r.field === 'account_number')?.value || '';
    const rowCells: any[] = [propName, acct];

    for (const col of columns) {
      if (col.type === 'month') {
        const k   = (col as any).key;
        const val = getGasValue(propRows, k);
        const amt = parseAmount(val);
        grandTotals[k] = (grandTotals[k] || 0) + amt;
        rowCells.push(val ? `$${amt.toFixed(2)}` : '');
      } else if (col.type === 'yearTotal') {
        const yr = (col as any).year;
        let yt = 0;
        for (const m of monthRange.filter(m => m.year === yr))
          yt += parseAmount(getGasValue(propRows, monthKey(m.month, m.year)));
        grandTotals[`year-${yr}`] = (grandTotals[`year-${yr}`] || 0) + yt;
        rowCells.push(yt > 0 ? `$${yt.toFixed(2)}` : '');
      } else if (col.type === 'tm') {
        const latest = monthRange[monthRange.length - 1];
        const v = latest ? getGasValue(propRows, monthKey(latest.month, latest.year)) : null;
        rowCells.push(v ? `$${parseAmount(v).toFixed(2)}` : '');
      } else { rowCells.push(''); }
    }

    const r = push(rowCells);
    const bg = ri % 2 === 0 ? 'F0F4FF' : C.whiteBg;
    sc(r, 0, cell(bg, false, 'left', 9));
    sc(r, 1, cell(bg, false, 'left', 9));
    for (let ci = 0; ci < columns.length; ci++) {
      const col    = columns[ci];
      const cellBg = col.type === 'yearTotal' || col.type === 'tm' ? 'EAF0FB' : col.type === 'comments' ? 'FAFAFA' : bg;
      sc(r, D + ci, cell(cellBg, false, 'right', 9));
    }
  }

  // Grand total
  {
    const totalCells: any[] = ['TOTAL', ''];
    for (const col of columns) {
      if (col.type === 'month') {
        const t = grandTotals[(col as any).key] || 0;
        totalCells.push(`$${t.toFixed(2)}`);
      } else if (col.type === 'yearTotal') {
        const t = grandTotals[`year-${(col as any).year}`] || 0;
        totalCells.push(`$${t.toFixed(2)}`);
      } else { totalCells.push(''); }
    }
    const r = push(totalCells);
    const boldCell = (bg: string, align: 'left' | 'right' = 'right') => ({
      font: { bold: true, color: { rgb: C.totalRowFont }, sz: 9 },
      fill: { fgColor: { rgb: bg } },
      alignment: { horizontal: align, vertical: 'center' },
      border: thinBorder(),
    });
    sc(r, 0, boldCell(C.totalRowBg, 'left'));
    sc(r, 1, boldCell(C.totalRowBg));
    for (let ci = 0; ci < columns.length; ci++) {
      const bg = columns[ci].type === 'yearTotal' || columns[ci].type === 'tm' ? 'C5D9F1' : C.totalRowBg;
      sc(r, D + ci, boldCell(bg));
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  applyStyles(ws, wsData, styles);
  ws['!cols']   = [{ wch: 28 }, { wch: 18 }, ...columns.map(c =>
    c.type === 'yearTotal' ? { wch: 11 } :
    c.type === 'tm'        ? { wch: 11 } :
    c.type === 'comments'  ? { wch: 20 } : { wch: 9 }
  )];
  ws['!freeze'] = { xSplit: 2, ySplit: 1 };
  return ws;
}

// ---------------------------------------------------------------------------
// Main export — two sheets
// ---------------------------------------------------------------------------
export function exportToExcel(
  data: ExtractedRow[],
  filename: string,
  provider: string,
) {
  const now     = new Date();
  const dateStr = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');

  const propMap              = groupByProperty(data);
  const { columns, monthRange } = buildColumns(data, now);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildRollUpSheet(propMap, columns, monthRange), 'Roll-Up');
  XLSX.utils.book_append_sheet(wb, buildReconSheet(propMap, columns, monthRange),  'Recon');
  XLSX.writeFile(wb, `UtilScraper_${provider.replace(/\s+/g, '')}_${dateStr}.xlsx`);
}